import { FirebaseConfig } from './firebase-config';

/**
 * The environment in which this app will function at runtime (think "development" vs. "production").
 */
export class RuntimeEnvironment {

   public get firebaseConfig(): FirebaseConfig { return this._firebaseConfig; }

   public constructor( public name: string, private _firebaseConfig: FirebaseConfig) {}

}
