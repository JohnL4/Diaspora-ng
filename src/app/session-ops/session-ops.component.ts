import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs/Rx';

import { UUIDv4 } from 'uuid-version4';

import { Cluster } from '../cluster';
import { PersistenceService } from '../persistence.service';
import { User } from '../user';

@Component({
  selector: 'app-session-ops',
  templateUrl: './session-ops.component.html',
  styleUrls: ['./session-ops.component.css']
})
export class SessionOpsComponent implements OnInit
{
   public get user(): Observable<User> { return this._persistenceSvc.currentUser; }
   public uuid: string;
      
   public get clusterName(): string { return this.cluster.name; };
   public set clusterName( aName: string)
   {
      // let me = this.constructor.name + '.set clusterName(): ';
      this.cluster.name = aName;
      // let jsonStringifiedName = JSON.stringify( aName);
      // console.log( me + `JSON name: ${jsonStringifiedName}`);
   };

   public loggingInWithEmail = false;
   public isNewEmailAccount = false;
   public userEmail: string;
   public emailPassword: string;
   public emailPassword2: string;
   public emailUserName: string;

   public get loginFailures(): Observable<Error> 
   {
      return this._persistenceSvc.loginFailures;
   }
   
   // private getUser(): void
   // {
   //    // ".then()" --> hooks up promise resolution event, I think.  Resolution will drive a UI "digest" cycle that will
   //    // result in the UI being updated with new data.  At this point, I'll just go ahead and call Angular "amazing".

   //    this._persistenceSvc.user.then( 
   //       user => {
   //          console.log( `user = ${user}`);
   //          console.log( `cluster has ${this.cluster.numSystems} systems`);
   //          this.user = user;
   //       });
   // }

   public delayedObservableInfoShowing = false;

   private get cluster(): Cluster { return this._persistenceSvc.currentClusterSubject.value; }
   
   // -------------------------------------------------  constructors  -------------------------------------------------

   constructor( /* private _cluster: Cluster, */ private _persistenceSvc: PersistenceService) { }

   // ---------------------------------------------------  methods  ----------------------------------------------------

   ngOnInit()
   {
      const me = this.constructor.name + '.ngOnInit(): ';
      console.log( me);
      // this.getUser();           // I think this basically hooks up the promise resolution event.
      this.uuid = UUIDv4.generateUUID();
   }

   public loginWithGoogle()
   {
      const me = this.constructor.name + '.login(): ';
      console.log( me + 'logging in');
      this._persistenceSvc.login();
      // alert( me + 'done');
   }

   public startLoginWithEmail(): void
   {
      this.loggingInWithEmail = true;
   }

   public loginWithEmail(): void
   {
      const me = this.constructor.name + 'loginWithEmail(): ';
      console.log(me
         + `Logging in w/email acct ${this.userEmail}, password ${this.emailPassword} ${this.isNewEmailAccount ? '(new account)' : ''}`);
      if (this.isNewEmailAccount)
      {
         if (this.emailPassword === this.emailPassword2)
         {
            this._persistenceSvc.createUserWithEmailAndPassword(this.userEmail, this.emailPassword, this.emailUserName);
         }
      }
      else
      {
         this._persistenceSvc.signInWithEmailAndPassword(this.userEmail, this.emailPassword);
      }
      this.loggingInWithEmail = false;
   }

   // TODO: delete
   public createNewUserWithEmail()
   {
      
   }

   public logout()
   {
      const me = this.constructor.name + '.logout(): ';
      console.log( me + 'logging out');
      // this.user = null;         // Not waiting for an authChanged event for two reasons: (1) the promise has certainly
      //                           // already been resolved, and promises are one-time-only events, and (2) we already know
      //                           // what the outcome of this call will be.
      this._persistenceSvc.logout();
   }

   public saveCluster()
   {
      this._persistenceSvc.saveCluster( this.cluster);
   }

   public showDelayedObservableInfo(): boolean
   {
      this.delayedObservableInfoShowing = ! this.delayedObservableInfoShowing;
      return false; // Prevent UI from taking this as an operation of some sort and refreshing.
   }
}
