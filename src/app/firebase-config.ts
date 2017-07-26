
export class FirebaseConfig {

   public get apiKey(): string { return this._apiKey; }
   public get authDomain(): string { return this._authDomain; }
   public get databaseURL(): string { return this._databaseURL; }
   public get projectId(): string { return this._projectId; }
   public get storageBucket(): string { return this._storageBucket; }
   public get messagingSenderId(): string { return this._messagingSenderId; }

   /**
    * 
    * @param _apiKey - Auth/general use
    * @param _authDomain - Auth with popup or redirect
    * @param _databaseURL - Realtime database
    * @param _projectId - Project Id - the name of the project in Firebase
    * @param _storageBucket - Storage
    * @param _messagingSenderId - Cloud messaging
    */
   public constructor( 
      private _apiKey: string,
      private _authDomain: string,
      private _databaseURL: string,
      private _projectId: string,
      private _storageBucket: string,
      private _messagingSenderId: string
   )
   {}
}
