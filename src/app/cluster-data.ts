/**
 * Data Transfer Object.
 */ 
import { ClusterContent } from "app/cluster-content";

export class ClusterData
{
   /**
    * UIDs of Users allowed to change sharing and make edits, expressed as object properties.
    */ 
   public writers: Object;

   /**
    * UIDs of Users allowed to view this cluster, expressed as object properties.
    */ 
   public readers: Object;

   /**
    * Complete XML of cluster.
    */
   public data: ClusterContent;
}
