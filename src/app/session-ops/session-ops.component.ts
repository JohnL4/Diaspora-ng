import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs/Rx';

import { UUIDv4 } from 'uuid-version4';

import { Cluster } from '../cluster';
import { PersistenceService } from '../persistence.service';
import { User } from '../user';
import { RuntimeEnvironment } from '../runtime-environment';

@Component({
  selector: 'app-session-ops',
  templateUrl: './session-ops.component.html',
  styleUrls: ['./session-ops.component.css']
})
export class SessionOpsComponent implements OnInit
{
   // --------------------------------------------  public data, accessors  --------------------------------------------
   
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

   public get environments(): RuntimeEnvironment[] { return this._persistenceSvc.environments; }

   // Has to be string, because (I guess) what we pass between this and HTML is strings.
   public get environmentIndex(): string { return this._persistenceSvc.currentEnvironmentIndex.toString(); }
   public set environmentIndex( anIndex: string)
   {
      const i = Number.parseInt( anIndex);
      if (isNaN(i))
         throw new Error( `Must be an integer: ${anIndex}`);
      else
         this._persistenceSvc.currentEnvironmentIndex = i;
   }
   
   /**
    * True if we are currently logging the user in with email/password.
    */
   public loggingInWithEmail = false;

   /**
    * True if we are setting up a new user email/password account.
    */
   public isNewEmailAccount = false;

   /**
    * The email the user wants to log in with or create.
    */
   public userEmail: string;

   /**
    * The password the user will use to authenticate with, when the user id is an email address.
    */
   public emailPassword: string;

   /**
    * Duplication password entry for validation when creating a new email-identified account.
    */
   public emailPassword2: string;

   /**
    * The publicly-visible user id the user wants for their account, when creating an account identified with an email address.
    */
   public emailUserName: string;

   /**
    * True if the user forgot their password and we requested the authentication service to respond.
    */
   public isForgottenPasswordSent = false;

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

   private get cluster(): Cluster { this._persistenceSvc.ensureCluster(); return this._persistenceSvc.currentClusterSubject.value; }
   
   // -------------------------------------------------  constructors  -------------------------------------------------

   constructor( /* private _cluster: Cluster, */ private _persistenceSvc: PersistenceService) { }

   // ------------------------------------------------  public methods  ------------------------------------------------

   ngOnInit()
   {
      const me = this.constructor.name + '.ngOnInit(): ';
      console.log( me);
      // this.getUser();           // I think this basically hooks up the promise resolution event.
      this.uuid = UUIDv4.generateUUID();
   }

   public handleEnvironmentChange()
   {
      const me = this.constructor.name + ".handleEnvironmentChange()";
      // console.log( `${me}: environmentIndex = ${this.environmentIndex}`);
      // if (localStorage)
      // {
      //    localStorage.setItem( 'environmentIndex', this.environmentIndex);
      // }
   }

   public loginWithGoogle()
   {
      this.setEnvironment();
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
      const me = this.constructor.name + '.loginWithEmail(): ';
      console.log(me
         + `Logging in w/email acct ${this.userEmail}, password ${this.emailPassword} ${this.isNewEmailAccount ? '(new account)' : ''}`);
      this.setEnvironment();
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

   public forgotPassword(): void
   {
      this._persistenceSvc.sendForgottenEmailPassword( this.userEmail);
      this.isForgottenPasswordSent = true;
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

   public clearLoginError(): void
   {
      this._persistenceSvc.loginFailures.next( null);
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

   public clearLocalStorage(): void
   {
      if (localStorage)
         localStorage.clear();
   }

   // -----------------------------------------------  private methods  ------------------------------------------------

   private setEnvironment(): void
   {
      this._persistenceSvc.setEnvironment( this.environments[ this._persistenceSvc.currentEnvironmentIndex]);
   }
}
