import { UUIDv4 } from 'uuid-version4';

import { Cluster } from './cluster';
import { User } from './user';

export const ASCII_US = "\x1F";

export class Utils {
}

export function dice(numDice: number, numSides: number): number
{
   let t = 0;
   for (let i = 0; i < numDice; i++)
      t += Math.floor( Math.random() * numSides) + 1;
   return t;
}

/**
 * A fate dice throw; a value in the range [-4,4].
 */
export function fateThrow()
{
   return dice(4, 3) - 8;
}

let _alphaBravo: string[] =
   [
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
      "Echo",
      "Foxtrot",
      "Golf",
      "Hotel",
      "India",
      "Juliet",
      "Kilo",
      "Lima",
      "Mike",
      "November",
      "Oscar",
      "Papa",
      "Quebec",
      "Romeo",
      "Sierra",
      "Tango",
      'Uniform',
      "Victor",
      "Whiskey",
      "X-ray",
      "Yankee",
      "Zulu"
   ];

/**
 * Returns the phonetic alphabet word for i in range [1..26], else null.
 */
export function alphaBravo( i: number): string
{
   if (i < 1 || i > 26)
      return null;
   else
      return _alphaBravo[i-1];
}

/**
 * Makes a universally unique cluster name by combining the cluster name with date from the User.  Note that neither
 * cluster nor user need to exist (both can be null) or have truthy data, but if they don't the cluster name will not
 * truly be unique.  Returned value is unencoded/unescaped.
 */
export function uniqueClusterName( aCluster: Cluster, aUser: User): string
{
   let uid = aUser ? aUser.uid : '';
   if (! uid)
      uid = "";
   const retval = uniqueClusterNameFromUid( aCluster, uid);
   return retval;
}

/**
 * Returns a new UUID.
 */
export function uniqueClusterNameFromUid( aCluster: Cluster, aUserUid: string): string
{
   const me = 'utils.uniqueClusterNameFromUid(): ';
   let retval: string;
   if (aCluster.uid)
      retval = aCluster.uid;
   else
      retval = UUIDv4.generateUUID();
   return retval;
}

/**
 * Encode a string "minimally", escaping only double & single quotes, left angle bracket and ampersand, into &quot;
 * &apos; &lt; &ampt; respectively.  Also, turn / into &sol; ("solidus").  This is because "/" is significant to
 * FireBase.
 */
export function minimalEncode( aString: string): string
{
   const retval = aString.replace(
      new RegExp('[\"\'<&/\x1F]', 'gi'),
      function( aMatch: string, anOffset: number, theWholeString: string)
      {
         let innerRetval: string;
         console.log( `aMatch: ${aMatch}`);
         switch (aMatch)
         {
         case '\"':
            innerRetval = '&quot;';
            break;
         case '\'':
            innerRetval = '&apos;';
            break;
         case '<':
            innerRetval = '&lt;';
            break;
         case '&':
            innerRetval = '&amp;';
            break;
         case '/':
            innerRetval = '&sol;';
            break;
         case '\x1F':
            innerRetval = '%1F';
            break;
         default:
            innerRetval = aMatch;
         }
         return innerRetval;
      });
   return retval;
}

/**
 * Decode a string encoded by {@see #minimalEncode}.
 */
export function minimalDecode( aString: string): string
{
   const retval = aString.replace(
      new RegExp( '&(quot|apos|lt|amp|sol);|%1F', 'gi'),
      function( aMatch: string, aP1: string, anOffset: number, theWholeString: string)
      {
         let innerRetval: string;
         switch (aMatch)
         {
         case '&quot;':
            innerRetval = '\"';
            break;
         case '&apos;':
            innerRetval = '\'';
            break;
         case '&lt;':
            innerRetval = '<';
            break;
         case '&amp;':
            innerRetval = '&';
            break;
         case '&sol;':
            innerRetval = '/';
            break;
         case '%1F':
            innerRetval = '\x1F';
            break;
         default:
            innerRetval = aMatch;
         }
         return innerRetval;
      });
   return retval;
}
