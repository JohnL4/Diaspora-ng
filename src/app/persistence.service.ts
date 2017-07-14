import { Injectable } from '@angular/core';
import { Observable, Observer, Subject, BehaviorSubject, Subscription } from 'rxjs/Rx';

import * as firebase from 'firebase';

import { Cluster } from './cluster';
import { ClusterData } from './cluster-data';
import { ClusterSerializerXML } from './cluster-serializer-xml';
import { Uid } from './uid';
import { User } from './user';
import { ASCII_US, uniqueClusterName, minimalEncode, minimalDecode } from './utils';
import { ClusterContent } from "app/cluster-content";

// I'm thinking this thing stores serialized XML somewhere and retrieves it from somewhere.
//
// Maybe into a global variable (how do we set that up) and via a text field somewhere (how do we set that up)?  In
// future, a FireBase d/b, maybe?  Need to get credentials from user for FireBase.

/**
 * Makes several Observables available, which point to various parts of the persistent data store in Firebase.
 * See nosql.org to d/b structure.
 */
@Injectable()
export class PersistenceService 
{
   // ============================================  Public Data, Accessors  ============================================
   
   public get loginFailures(): Subject<Error> { return this._loginFailures; }

   /**
    * Current User; may be null.
    */
   public get currentUser(): BehaviorSubject<User> { return this._curUser; }

   /**
    * The current cluster (which may not have been saved yet), as a Subject.
    */
   public get currentClusterSubject(): BehaviorSubject<Cluster> {
      return this._currentGeneratedCluster
         || this._currentPersistedCluster;
   }

   /**
    * The current cluster (which may not have been saved yet, and/or, in the case of a persisted cluster, may be out of
    * date).
    */
   public get currentCluster(): Cluster {
      return (this._currentGeneratedCluster && this._currentGeneratedCluster.value)
         || (this._currentPersistedCluster && this._currentPersistedCluster.value);
   }

   public set currentGeneratedCluster( aCluster: Cluster) {
      if (this._currentPersistedCluster || this._currentPersistedClusterSubscription)
      {
         if (this._currentPersistedClusterSubscription)
            this._currentPersistedClusterSubscription.unsubscribe();
         // TODO: unsubscribe or whatever needs to be done (the above is just a guess).
      }
      this._currentGeneratedCluster = new BehaviorSubject<Cluster>( aCluster);
   }

   /**
    * List cluster meadata objects sorted in the correct order (e.g., last edited by/when, notes, etc.).
    */
   public get clusterMetadata(): Observable<Cluster[]> { return this._clusterMetadata; }

   /**
    * Current cluster from persistent (possibly shared) store.
    */
   private get currentPersistedCluster(): BehaviorSubject<Cluster> { return this._currentPersistedCluster; }
   
   // =================================================  Private Data  =================================================
   
   /**
    * Map from cluster unique name to Cluster.  Zero or more of these clusters will have all data filled in (and not
    * necessarily up to date); the rest will have only metadata.
    */ 
   private _latestClusterMap: Map<string, Cluster>;
   
   private _firebaseConfig = {
            apiKey: 'AIzaSyBiNVpydoOUGJiIavCB3f8qvB6ARYSy_1E',
            authDomain: 'diaspora-21544.firebaseapp.com',
            databaseURL: 'https://diaspora-21544.firebaseio.com',
            storageBucket: 'diaspora-21544.appspot.com',
            messagingSenderId: '222484722746'
      };

   // private _ui: any;            // Firebase ui
   private _db: firebase.database.Database;
   private _authProvider: firebase.auth.GoogleAuthProvider;
   private _googleAccessToken: firebase.auth.AuthCredential;

   /**
    * Temporary holder for data used in creating a new email user, will be purged upon successful authentication.
    */
   private _emailUser: User;

   /**
    * Sequence of login failures, as time goes by.
    */
   private _loginFailures = new BehaviorSubject<Error>( null);

   // private _userPromise: Promise<User>;

   // On "deferred" promises: this is for the situation in which, when we create the promise ("new Promise(...)"), we do
   // not start the asynchronous/blocking work that will result in promise fulfillment.  Instead, that work has either
   // already been started or will be started elsewhere/elsewhen.  So, we simply save off an object holding pointers to
   // the resolve/reject functions so we can call them later (which we do).  See the handling of
   // this._userPromiseDeferred in this service.
   // 
   // See
   // http://stackoverflow.com/questions/31069453/creating-a-es6-promise-without-starting-to-resolve-it/31069505#31069505
   //
   // private _userPromiseDeferred: {resolve: any, reject: any};

   private _users: Observable<Map<string, User>>;
   private _latestUserMap: Map<string, User>;
   
//   /**
//    * List of names of clusters that are visible to the current user.
//    */
//   private _visibleClusters: BehaviorSubject<BehaviorSubject<Cluster>[]>;

   /**
    * Observable<Object>, in which each object has a property (probably a boolean, but could be an int) whose name
    * is the UID of a cluster and whose value is irrelevant.
    */
   // NOTE: Can't declare type Uuid as alias for string and have Typescript flag cases in which a non-Uuid is supplied here.  
   // The type equivalence doesn't save us.
   private _visibleClusterUuids: Observable<Object>; 

   private _visibleClusterMap: Map<Uid, Cluster>;
   private _visibleClusterMapSubject: BehaviorSubject<Map<Uid, Cluster>>;
   
   /**
    * Map from cluster unique name to a cluster, decorated as needed for processing ({@see SeenCluster} is the
    * decoration).
    */
   private _seenClusterMap: Map<string, SeenCluster> = new Map<string, SeenCluster>();
   
   private _clusterMetadata: BehaviorSubject<Cluster[]> = new BehaviorSubject<Cluster[]>(new Array<Cluster>());


   private _currentGeneratedCluster: BehaviorSubject<Cluster>;
   private _currentGeneratedClusterSubscription: Subscription;
   
   private _currentPersistedCluster: BehaviorSubject<Cluster>;
   private _currentPersistedClusterSubscription: Subscription;
   
   private _curUser: BehaviorSubject<User> = new BehaviorSubject<User>(null);
   
   private _initialized = false;

   private _xmlSerializer: ClusterSerializerXML;
   
   // =================================================  Constructors  =================================================
   
   constructor( )
   {
      const me = this.constructor.name + '.ctor(): ';
      // This thing is one of the very first objects constructed, by the DI mechanism, at app initialization.
      console.log( me + `=============================================================================================`);
   }

   // ================================================  Public Methods  ================================================
   
   /**
    * Initialize firebase and hook up AuthStateChanged event.
    */
   public init(): void
   {
      const me = this.constructor.name + '.init(): ';
      console.log( me);
      if (this._initialized)    // Probably not threadsafe, but I'll think about that tomorrow.  After all, tomorrow is another day.
      {
         console.log( me + 'already initialized');
         return;
      }

      this._xmlSerializer = new ClusterSerializerXML();
      
      firebase.initializeApp( this._firebaseConfig);

      // this._userPromise = new Promise(
      //    ( resolve, reject) => this._userPromiseDeferred = {resolve: resolve, reject: reject});
      
      firebase.auth().onAuthStateChanged( this.authStateChanged.bind( this), this.authError.bind( this));

      this._initialized = true;
      console.log( me + 'initialized');
   }

   // ------------------------------------------------  Authentication  ------------------------------------------------
   
   /**
    * Returns a User object for the given uid. May return null.
    */
   public getUser( aUid: string): User
   {
      let retval: User;
      if (this._latestUserMap)
         retval = this._latestUserMap.get( aUid);
      return retval;
   }

   /**
    * Initiate login to Firebase.
    */
   public login(): void
   {
      this._loginWithPopup();
   }

   /**
    * Creates a new user account having the given email address and password.
    * @param anEmail 
    * @param aPassword 
    */
   public createUserWithEmailAndPassword(anEmail: string, aPassword: string, aUserName: string): void
   {
      const me = this.constructor.name + '.createUserWithEmailAndPassword(): ';
      this._emailUser = new User(null, aUserName, anEmail, null);
      firebase.auth().createUserWithEmailAndPassword(anEmail, aPassword)
         .catch( this._raiseLoginError.bind( this));
   }

   /**
    * Signs in to the user account having the given email address, using the given password.
    * @param anEmail 
    * @param aPassword 
    */
   public signInWithEmailAndPassword(anEmail: string, aPassword: string): void
   {
      const me = this.constructor.name + '.signInWithEmailAndPassword(): ';
      console.log( me);
      firebase.auth().signInWithEmailAndPassword(anEmail, aPassword ? aPassword : '')
         .catch( this._raiseLoginError.bind( this));
   }

   public sendForgottenEmailPassword(anEmailAddress: string): void
   {
      const me = this.constructor.name + '.sendForgottenEmailPassword(): ';
      console.log(me + `Requesting password reset for ${anEmailAddress}`);
      if (anEmailAddress)
         firebase.auth().sendPasswordResetEmail(anEmailAddress).then(
            (function (obj: any)
            {
               console.log(`successfully sent password reset request, result = ${obj}`);
               // Hack to get feedback to user: raise login error.
               this._raiseLoginError(
                  new Error(`Sent password reset email to ${anEmailAddress}; check your spam folder.  
                     (This is not actually an error, unless you consider forgetting your password an error.)`));
            }).bind(this),
            this._raiseLoginError.bind(this)); // error
      else
         this._raiseLoginError(new Error(
            'You need to specify an email address so we know where to send a password reset email.'));
   }

   public logout()
   {
      const me = this.constructor.name + '.logout(): ';
      // alert( "logging out");
      console.log( me);
      firebase.auth().signOut().then( function() {
         console.log( 'signout successful');
      }).catch( function( anError: Error) {
         console.log( `signout error: ${anError.message}`);
      });
   }
   
   // public get user(): Promise<User>
   // {
   //    return this._userPromise;
   // }
   
   // -------------------------------------------------  Cluster Data  -------------------------------------------------
   
   /**
    * Ensure that this service actually has a cluster (which may be en empty dumy).
    */
   public ensureCluster(): void
   {
      if (this.currentCluster)
      {
         // Do nothing
      }
      else
      {
         // Just make one up!
         this._currentGeneratedCluster = new BehaviorSubject( new Cluster());
      }
   }

   /**
    * Initiate a request to the back end to load the cluster.
    *
    * @param aUniqueName Minimally-encoded cluster name + ASCII US + user uid
    */
   public loadCluster( aUniqueName: string): void
   {
      const me = this.constructor.name + '.loadCluster(): ';
      // let uniqueName = JSON.stringify( minimalEncode( aUniqueName));
      // const uniqueName = encodeURIComponent( aUniqueName);
      console.log( me + `loading ${aUniqueName}`);
      // if (this._currentPersistedCluster || this._currentPersistedClusterSubscription)
      // {
         if (this._currentPersistedClusterSubscription)
            this._currentPersistedClusterSubscription.unsubscribe();
         if (this._currentGeneratedClusterSubscription)
         {
            this._currentGeneratedClusterSubscription.unsubscribe();
            this._currentGeneratedClusterSubscription = null;
         }
         if (this._currentGeneratedCluster)
            this._currentGeneratedCluster = null;
         
         // TODO: unsubscribe or whatever needs to be done (the above is just a guess).
      // }
      this._currentPersistedCluster = new BehaviorSubject<Cluster>( new Cluster());
      this._currentPersistedClusterSubscription = this.makeDatabaseSnapshotObservable( `/clusterData/${aUniqueName}/data`)
         .map( s => this.parseClusterData( aUniqueName, s.val()))
         .multicast( this._currentPersistedCluster)
         .connect();
   }

   /**
    * Initiate a request to the back end to delete the given cluster.
    *
    * @param aUniqueName Same as that for {@see #loadCluster}.
    */
   public deleteCluster(aUniqueName: string): void
   {
      if (!this.currentUser.value)
         return;
      const me = this.constructor.name + '.deleteCluster(): ';
      // const uniqueName = encodeURIComponent( aUniqueName);
      console.log(me + `deleting ${aUniqueName}`);
      if (this._currentGeneratedClusterSubscription)
      {
         console.log(me + 'unsubscribing');
         this._currentPersistedClusterSubscription.unsubscribe();
         this._currentPersistedClusterSubscription = null;
      }

      if (!this._db) this._db = firebase.database();

      const updates = Object.create( null);

      // Note (TODO): this doesn't (yet) do any sort of reference counting, purging entire cluster only when this is the last
      // owner.  That'll have to be a later step.

      updates[`/users/${this.currentUser.value.uid}/clusters/${aUniqueName}`] = null;

      updates[`/clusters/${aUniqueName}/metadata`] = null;

      // These three permissions lists really should already be null, since I moved them over to /clusterData.
      updates[`/clusters/${aUniqueName}/owners`] = null;
      updates[`/clusters/${aUniqueName}/editors`] = null;
      updates[`/clusters/${aUniqueName}/viewers`] = null;

      updates[`/clusterData/${aUniqueName}`] = null;

      this._db.ref().update( updates); // TODO: test to make sure permission failure in one location blocks entire transaction.
                                       // For example, if an editor (not an owner) tries to delete a cluster.
   }
   
   public saveCluster( aCluster: Cluster): void
   {
      // let uniqueName = JSON.stringify( minimalEncode( uniqueClusterName( aCluster, this.currentUser.value)));
      // const uniqueName = encodeURIComponent( uniqueClusterName( aCluster, this.currentUser.value));
      let uniqueName: string;
      if (aCluster.uid)
         uniqueName = aCluster.uid;
      else
      {
         uniqueName = uniqueClusterName( aCluster, this.currentUser.value);
         aCluster.uid = uniqueName; // Assumed to be a straight UUId.
      }
      const dbRef = this._db.ref();

      // Metadata
      const clusterProps = { 
            name: aCluster.name, 
            lastAuthor: this.currentUser.value.uid,
            lastChanged: new Date( Date.now()), 
            notes: aCluster.notes ? aCluster.notes : ''
      };
      
      // XML & other "full" cluster data
      this._xmlSerializer.cluster = aCluster;
      const xml = this._xmlSerializer.serialize();
      const owners = Object.create( null); // TODO: do we need this?
      owners[ `${this.currentUser.value.uid}`] = 1;

      const updates = Object.create( null);

      // Clusters visible to current user: this one that we're saving, for sure.
      updates[`/users/${this.currentUser.value.uid}/clusters/${aCluster.uid}`] = true;
      updates[`/clusters/${uniqueName}/metadata`] = clusterProps;
      updates[`/clusterData/${uniqueName}/data/xml`] = xml;
      updates[`/clusterData/${uniqueName}/owners`] = owners;

      dbRef.update( updates);
   }

   /**
    * Get cluster xml from some place wondrous and mysterious (like a server).
    */
   public getClusterXml(): string
   {
      return '';
   }

   // ===============================================  Private Methods  ================================================
   
   // ------------------------------------------------  Authentication  ------------------------------------------------
   
   private _loginWithPopup(): void
   {
      const me = this.constructor.name + '._loginWithPopup(): ';
      if (! this._authProvider)
         this._authProvider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup( this._authProvider).then(function (result)
      {
         // This gives you a Google Access Token. You can use it to access the Google API.
         const token = result.credential.accessToken;
         // The signed-in user info.
         const user = result.user;
         // ...
      }).catch(function (error: any)
      {
         // Handle Errors here.
         const errorCode = error.code;
         const errorMessage = error.message;
         // The email of the user's account used.
         const email = error.email;
         // The firebase.auth.AuthCredential type that was used.
         const credential = error.credential;
         alert( me + `Error: code = ${errorCode}; msg = ${errorMessage}\nemail = ${email}; credential = ${credential}`);
      });
   }

   private _loginWithRedirect(): void
   {
      const me =  this.constructor.name + '.login(): ';
      console.log( me);
      if (! this._authProvider)
         this._authProvider = new firebase.auth.GoogleAuthProvider();
      console.log( me + 'signing in');
      firebase.auth().signInWithRedirect( this._authProvider);
      // alert( "about to process redirect result");
      firebase.auth().getRedirectResult().then( (function( result: firebase.auth.UserCredential) {
         if (result.credential) {
            this._googleAccessToken = result.credential;
            console.log( me + `accessToken = "${this._googleAccessToken}`);
         }
         this._user = result.user;
         console.log( me + `logged in user "${this._user}"`);
         // alert( "login done");
      }).bind( this)).catch( (function( error: Error) {
         console.log( `${me} ${error.message}`); }).bind( this));
      console.log( me + 'done');
   }

   private _raiseLoginError( anErrorObj: any): void
   {
      const me = this.constructor.name + '._raiseLoginError(): ';
      console.log(me + `Error siging in: ${anErrorObj.code}: ${anErrorObj.message}`);
      const newError = new Error(anErrorObj.message);
      if (anErrorObj.code)
         newError.name = anErrorObj.code;
      this._loginFailures.next(newError);
   }

   private authStateChanged( aFirebaseUser: firebase.User): void
   {
      const me = this.constructor.name + '.authStateChanged(): ';
      // let user: User;
      if (aFirebaseUser)
      {
         const newUser = new User( aFirebaseUser.uid,
                          aFirebaseUser.displayName || aFirebaseUser.email || aFirebaseUser.uid,
                          aFirebaseUser.email,
                          new Date( Date.now()));
         console.log( me + `User logged in: ${newUser} with provider ${aFirebaseUser.providerId}`);
         if (this._emailUser)
         {
            // Temp. data from creating new email user -- transfer to newUser object and purge.
            newUser.name = this._emailUser.name;
            this._emailUser = null;
         }
         else
         {
            if (aFirebaseUser.displayName)
            {
               // Do nothing -- user came in with a display name, so assume it's good.
            }
            else
            {
               // We don't really care about the provider id here -- if there's no display name, we need to try to get it.
               newUser.isDisplayNameNeeded = true; 
               console.log(me + 
                  `Firebase user uid ${aFirebaseUser.uid} has displayName "${aFirebaseUser.displayName}" and email ${aFirebaseUser.email}`);
               console.log(me + '---- provider data:');
               for (const providerData of aFirebaseUser.providerData)
               {
                  console.log(me + `displayName\t: ${providerData.displayName}`);
                  console.log(me + `email\t: ${providerData.email}`);
                  console.log(me + `photoURL\t: ${providerData.photoURL}`);
                  console.log(me + `providerId\t: ${providerData.providerId}`);
                  console.log(me + `uid\t: ${providerData.uid}`);
               }
            }
         }
         this._curUser.next( newUser);
         if (newUser.uid)
         {
            if (! this._db) this._db = firebase.database();
            const dbRef = this._db.ref();
            console.log( me + `dbRef = ${dbRef}`);
            // userPublicProps: publicly-readable data for a user
            const userPublicProps = { name: newUser.name };
            // userProps: private data for a user.
            // const userProps = { email: newUser.email,
            //                   lastLogin: newUser.lastLogin.toISOString(),
            //                   timeZoneOffset: newUser.lastLogin.getTimezoneOffset()
            //                 };
            const updates = Object.create( null);
            if (newUser.isDisplayNameNeeded)
            {
               // Do nothing -- don't overwrite whatever's in the database with whatever garbage is in the user's current display name.
            }
            else
            {
               updates[`/usersPublic/${newUser.uid}`] = userPublicProps;
            }
            updates[`/users/${newUser.uid}/email`] = newUser.email;
            updates[`/users/${newUser.uid}/lastLogin`] = newUser.lastLogin;
            updates[`/users/${newUser.uid}/timeZoneOffset`] = newUser.lastLogin.getTimezoneOffset();
            dbRef.update( updates); // Performs insert if key doesn't exist, so that's good.

            this.connectToDatabase( newUser); // Now go get the clusters available to the current user.
         }
         else
            console.log( me + `WARNING: no uid for user ${newUser.name}`);
      }
      else
      {
         console.log( me + 'auth state changed, but passed user is null or empty, assuming logged out');
         this._curUser.next( null);
         // this._clusterMetadata.next( new Array<Cluster>()); // Once we purge this list, we don't get further 
                                                               // notifications if the user logs back in, so there's no 
                                                               // easy way to get it back.
      }
      // this._userPromiseDeferred.resolve( this._curUser); // We know _userPromiseDeferred won't be null because we create it
      //                                                 // before hooking up this event handler.
      this._loginFailures.next( null); // Auth state changed ==> no errors.  Authentication failures will not change the auth state.
   }

   private authError( aFirebaseAuthError): void
   {
      const me = this.constructor.name + '.authError(): ';
      console.log( me + `auth error: ${aFirebaseAuthError.message}`);
      this._curUser.error( new Error( `${me} FireBase authentication error: ${aFirebaseAuthError.message}`));
      // this._userPromiseDeferred.reject( aFirebaseAuthError);
   }

   // ---------------------------------------------------  Database  ---------------------------------------------------
   // - - - - - - - - - - - - - - - - - - -  (first user data, then cluster data)  - - - - - - - - - - - - - - - - - - -
   
   /**
    * Establish initial d/b connections. Note that initial connections may result in Observables/Promises which will
    * result in further connection requests.
    */
   private connectToDatabase( aUser: User)
   {
      const me = this.constructor.name + '.connectToDatabase(): ';
      if (aUser && aUser.uid)
      {
         this._db = firebase.database();
         console.log( me + `initialized firebase, db = "${this._db}"`);

         if (this._visibleClusterMap == null)
            this._visibleClusterMap = new Map<Uid, Cluster>();
         if (this._visibleClusterMapSubject == null)
         {
            this._visibleClusterMapSubject = new BehaviorSubject<Map<Uid, Cluster>>( this._visibleClusterMap);
            this._visibleClusterMapSubject.debounceTime( 300)
               .subscribe( m => this.sortAndPublishMetadata( m));
         }

         // TODO: make this a BehaviorSubject<Map<string,Cluster>>.
         // this._visibleClusters = new BehaviorSubject<BehaviorSubject<Cluster>[]>(new Array<BehaviorSubject<Cluster>>());
         // this._visibleClusters.subscribe( clusters => this.handleVisibleClusterListChange( clusters));

         /* this._visibleClusterUuids = */ this.makeDatabaseSnapshotObservable( `/users/${aUser.uid}/clusters`)
            .map( s => <Object> s.val()) // Object of cluster uuids
            .subscribe( uidObject => this.handleVisibleClusterListChange( uidObject))
            ;

//         // $uid/clusters is a list of unique names
//         let visibleClusterNamesSubscription
//            = this.makeDatabaseSnapshotObservable( `/users/${aUser.uid}/clusters`) 
//            .map( s => { let uniqueNamesObj = s.val();
//                         let names = new Array<BehaviorSubject<Cluster>>();
//                         for (let uniqueName in uniqueNamesObj)
//                         {
//                            let cluster = this._clusterObservable[uniqueName].cluster;
//                            if (! cluster)
//                            {
//                               cluster = new Cluster();
//                               cluster.uid = uniqueName;
//                            }
//                            names.push( new BehaviorSubject<Cluster>( cluster));
//                         }
//                         return names;
//                       })
//            .multicast( this._visibleClusters)
//            .connect();
         
         // TODO: keep cluster metadata, but build differently.  Subscribe to each cluster separately, and provide next
         // result appropriately.  So... change in xml only, no next observable, but change in metadata ==> next result.
         // Change in _visbibleClusterNames almost certainly means at least a change in metadata ROWS (insert, delete).
      //    const clusterMetadataSubscription = this.makeDatabaseSnapshotObservable( '/clusters')
      //       .map( s => this.parseMetadata( s.val()))
      //       .multicast( this._clusterMetadata) // Uses the given Subject to create an Observable that can be subscribed
      //                                          //   to multiple times w/out re-triggering the sequence.
      //       .connect();                        // Actually starts the base Observable running, with updates to the
      //                                          //   subject.

         this._users = this.makeDatabaseSnapshotObservable( '/usersPublic').map( s => this.parseUsers( s.val()));
         this._users.subscribe( map => {this._latestUserMap = map; this.getDisplayNameFromUserMap(); });

         // TODO: make Behavior Subject containing cluster arrays?  Answer: YES, probably a good idea.  Then we wouldn't
         // need to bother with this "latest" junk, because a BehaviorSubject will always have the latest value.

         // let subscription = this._clusterNamesObservable.subscribe(
         //    (snapshot: firebase.database.DataSnapshot) => this.clusterNamesValueChanged( snapshot)
         //    ,(err) => this.firebaseError( err) // Doesn't work.
         // );
      }
      else
         console.log( me + 'WARNING: current user not yet initialized; cannot establish references to user-specific data');
   }

   /**
    * If required, try to get the current user's display name from the public data map.
    */
   private getDisplayNameFromUserMap(): void
   {
      const me = this.constructor.name + '.getDisplayNameFromUserMap(): ';
      const curUser = this._curUser ? this._curUser.value : null;
      if (curUser && curUser.isDisplayNameNeeded)
      {
         const userFromPublicMap = this._latestUserMap.get( curUser.uid);
         if (userFromPublicMap)
         {
            console.log( me + `Overwriting current user name (${curUser.name}) with "${userFromPublicMap.name}"`);
            // Overwrite whatever junk was in the current user's 'name' property (probably an email address or even a uid).
            curUser.name = userFromPublicMap.name; 
            this._curUser.next( curUser); // Publish
            // At this point, we really should turn off curUser.isDisplayNameNeeded, but leaving it on allows to change
            // user display names on the fly, so what the heck.  If it becomes a performance problem, we can turn it off.
         }
      }
   }

   /**
    * Transforms incoming object, keyed by uid and having values from the public user info section of the d/b (e.g.,
    * property 'name' (not 'displayName')) into User objects having the corresponding properties (and only those properties).
    * @param aSnapshot 
    */
   private parseUsers( aSnapshot: Object): Map<string, User> {
      const me = this.constructor.name + '.parseUsers(): ';
      const retval = new Map<string, User>();
      for (const uid in aSnapshot)
      {
         if (aSnapshot.hasOwnProperty(uid))
         {
            const user = aSnapshot[uid];
            user.uid = uid;
            retval.set(uid, user);
         }
      }
      console.log( me + `snapshot contains ${retval.size} users`);
      return retval;
   }

   // - - - - - - - - - - - - - - - - - - - - - - - - -  Cluster Data  - - - - - - - - - - - - - - - - - - - - - - - - -
   
   /**
    * Called when the list of names of clusters visible to the current user has changed, with the new list of Cluster
    * subjects.  Will drop subscriptions for deleted clusters and start new ones for new clusters.  Subscriptions for
    * existing clusters will continue unchanged.
    *
    * @param aClusterUidsObject DataSnapshot value whose properties are the currently visible cluster uuids.
    */
   private handleVisibleClusterListChange( aClusterUidsObject: Object): void
   {
      const me = this.constructor.name + '.handleVisibleClusterListChange(): ';
      console.log( me);
      // We're using the _seenClusterMap to manage subscriptions (new ones and unsubscribing from deleted clusters).
      this._seenClusterMap.forEach( sc => {sc.seen = false; });
      for (const clusterUid in aClusterUidsObject)
      {
         if (this._seenClusterMap.has( clusterUid))
            this._seenClusterMap.get( clusterUid).seen = true;
         else
         {
            // const newCluster = new Cluster();
            // newCluster.uid = clusterUid;
            // let clusterSubject = new BehaviorSubject<Cluster>( newCluster);
            const clusterSubscription = this.makeDatabaseSnapshotObservable( `/clusters/${clusterUid}/metadata`)
               .map( s => 
               { 
                     const sval = s.val(); // sval == null ==> cluster has been deleted
                     const c = new Cluster( sval); 
                     c.uid = clusterUid; // Note that cluster uid is not part of the snapshot object, but is instead the
                                         // root of the snapshot object.
                     return c; 
                  })
               .subscribe( c => this.updateAndPublishClusterMap( c))
               ;
            const sc = new SeenCluster( true, /* newCluster, */ clusterSubscription);
            this._seenClusterMap.set( clusterUid, sc);
         }
      }
      const unseenKeys = new Array<string>();
      this._seenClusterMap.forEach( (val, key) =>
                                       {if (! val.seen) {
                                          unseenKeys.push( key);
                                          val.clusterSubscription.unsubscribe();
                                       }
                                       });
      for (const key of unseenKeys)
      {
         if (this._visibleClusterMap.has( key))
            this._visibleClusterMap.delete( key);
         this._seenClusterMap.delete( key); 
      }
      if (unseenKeys.length)
         this._visibleClusterMapSubject.next( this._visibleClusterMap);

      // At this point, the only piece of data we're guaranteed to have is cluster uid; and that doesn't do any good to
      // sort on.
   }

   /**
    * Updates map of visible clusters (uid --> cluster) and publishes the updated map via mapSubject.next().
    * @param aCluster 
    */   
   // Will honor every event by updating the map and calling subject.next(newMap).  However, said subject will be 
   // throttled before being sorted into a list for display.
   private updateAndPublishClusterMap( aCluster: Cluster): void
   {
      const me = this.constructor.name + '.updateAndPublishClusterMap(): ';
      console.log( me);
      this._visibleClusterMap.set( aCluster.uid, aCluster);
      this._visibleClusterMapSubject.next( this._visibleClusterMap);
   }

   /**
    * Sort given map into a list of cluster metadata objects and raise an event to cause them to be displayed.
    * @param aClusterMetadataMap 
    */
   private sortAndPublishMetadata( aClusterMetadataMap: Map<Uid, Cluster>)
   {
      const me = this.constructor.name + '.sortAndPublishMetadata(): ';
      console.log( me);
      const metadataList = new Array<Cluster>();
      aClusterMetadataMap.forEach( (cluster: Cluster, uid: Uid) => metadataList.push( cluster));
      metadataList.sort( (a, b) => 
            {
                  if (a.name < b.name) return -1;
                  else if (a.name === b.name) return 0;
                  else return 1;
            });
      console.log( me + `metadataList has ${metadataList.length} items`);
      this._clusterMetadata.next( metadataList);
   }
   
//    /**
//     * Returns a map from cluster name to cluster metadata (e.g., last edited by/when, notes), which map is created from
//     * the given d/b snapshot.
//     */
//    private parseMetadata( aSnapshot: Object): Cluster[]
//    {
//       const me = this.constructor.name + ".parseMetadata(): ";
//       this._latestClusterMap = new Map<string, Cluster>();
//       const retval = Array<Cluster>();
//       for (const key in aSnapshot)
//       {
//          if (aSnapshot.hasOwnProperty( key))
//          {
//             // let keyTuple = minimalDecode( JSON.parse( key));
//             const keyTuple = decodeURIComponent( key);
//             let [name, uid] = keyTuple.split( ASCII_US, 2);
//             name = minimalDecode( name);
//             const clusterObj = <Cluster> aSnapshot[key]; // Note: just casting an Object (which is what I think aSnapshot[key]
//                                                       // is, since Firebase knows nothing about our class hierarchy) to
//                                                       // Cluster does not actually MAKE the thing a Cluster, it just
//                                                       // satisfies TypeScript's demand for type "congruence".
//             // clusterObj.lastAuthor = uid;
//             // clusterObj.name = name;

//             const cluster = new Cluster();
//             cluster.lastChanged = clusterObj.lastChanged;
//             cluster.lastAuthor = uid;
//             cluster.name = name;

//             retval.push( cluster); 
//             this._latestClusterMap.set( key, cluster);
//          }
//       }
//       console.log( me + `aSnapshot contains ${retval.length} clusters`);
//       return retval;
//    }

   /**
    * Analogous to {@see #parseMetadata}, returns a Cluster object created from the given snapshot's "xml" property.
    */
   private parseClusterData( aUid: Uid, aSnapshot: Object): Cluster
   {
      const me = this.constructor.name + '.parseClusterData(): ';
      let retval: Cluster;
      if (aSnapshot)
      {
         const snapshot = <ClusterContent> aSnapshot; 
         const serializer = new ClusterSerializerXML();
         const errors = serializer.deserialize( snapshot.xml);
         if (errors)
            console.log( me + `ERRORS:\n\t${errors}`);
         retval = serializer.cluster;
         retval.uid = aUid;
      }
      else
      {
         console.log( me + 'NOTE: data snapshot is null, so no cluster');
         retval = null;
      }
      return retval;
   }

   // - - - - - - - - - - - - - - - - - - - -  Private Database Utility Methods  - - - - - - - - - - - - - - - - - - - -
   
   /**
    * Makes an Observable of DataSnapshots out of a Firebase node, so the app can subscribe to new snapshots as they are
    * available.
    */
   private makeDatabaseSnapshotObservable( aNoSqlTreeNodeName: string): Observable<firebase.database.DataSnapshot>
   {
      if (! this._db) this._db = firebase.database();
      const dbRef = this._db.ref( aNoSqlTreeNodeName);
      const retval = <Observable<firebase.database.DataSnapshot>> Observable.fromEventPattern(
         (function addHandler( h: (a: firebase.database.DataSnapshot, b?: string) => any) {
            // Need to explicitly bind to firebaseError here because there's no easy way (that I can tell) to
            // generate/catch errors using the Observable subscription.
            dbRef.on( 'value', h, this.firebaseError); }).bind(this), 
         function delHandler( h: (a: firebase.database.DataSnapshot, b?: string) => any) {
            dbRef.off( 'value', h);
         }
         // ,(aSnapshot: firebase.database.DataSnapshot) => aSnapshot
      );
      return retval
         // .map((s,i) => <firebase.database.DataSnapshot>s)
      ;
   }

   /**
    * Records that a FireBase error has occurred.  (Doesn't do a whole lot more than that right now.)
    */ 
   private firebaseError( anError: Error): void
   {
      const me = 'PersistenceService.firebaseError(): '; // this.constructor.name + ".firebaseError(): ";
      console.log( me + `firebaseError(): ` + anError.message);
      // if (anError.message.match( /^permission_denied/))
      //    this.login();
   }

}

// =================================================  Helper Classes  ==================================================

/**
 * A tuple decorating a cluster with a "seen" boolean for processing.
 */ 
class SeenCluster 
{
      /**
       * 
       * @param seen True iff cluster has been seen during processing
       * @param cluster The cluster itself
       * @param clusterSubscription Subscription to cluster updates
       */
   constructor( public seen: boolean, /* public cluster: Cluster, */ public clusterSubscription: Subscription) {}
}
