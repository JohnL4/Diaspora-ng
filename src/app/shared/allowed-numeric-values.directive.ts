import { Directive, Input, OnChanges, SimpleChanges } from '@angular/core';
import { AbstractControl, NG_VALIDATORS, Validator, ValidatorFn, Validators } from '@angular/forms';

const SELECTOR: string = "allowedNumericValues";

class Range
{
   public Low: number;
   public High: number;
   
   constructor ( aLow: number,  aHigh: number)
   {
      this.Low = aLow;
      this.High = aHigh;
   }
}

export function allowedNumericValuesValidator( anAllowedValuesSpec: string): ValidatorFn
{
   let errors: string[] = [];   // Errors from parsing allowed values specification
   let ranges : Range[] = [];   // Allowed ranges, used in validation.
   let rangeSpecs = anAllowedValuesSpec.split( /\s*,\s*/);
   for (let r of rangeSpecs)
   {
      let ends : string[] = r.split( /\s*-\s*/);
      if (ends.length == 1)
      {
         let end : number = Number(ends[0]);
         if (isNaN( end))
            errors.push( r + " is NaN");
         else
            ranges.push( new Range( end, end));
      }
      else if (ends.length == 2)
      {
         let low:number = Number(ends[0]);
         let high:number = Number(ends[0]);
         if (isNaN( low) || isNaN( high))
            errors.push( r + " has NaN");
         else
            ranges.push( new Range( low, high));
      }
      else
         errors.push( r + " has bad syntax");
   }
   if (errors.length > 0)
      throw new Error( errors.join( "; "));

   return (control: AbstractControl): {[key: string]: any} => {
      const numberToBeValidated = control.value;
      const num = Number( numberToBeValidated);
      if (isNaN( num))
         return {SELECTOR: {numberToBeValidated}};
      let isGood: boolean = false;
      for (let r of ranges)
      {
         if (r.Low <= num && num <= r.High)
         {
            isGood = true;
            break;
         }
      }
      return isGood ? null : {SELECTOR: {numberToBeValidated}};
   };
}

@Directive({
   selector: '[' + SELECTOR + ']',
   providers: [{provide: NG_VALIDATORS, useExisting: AllowedNumericValuesDirective, multi: true}]
})
export class AllowedNumericValuesDirective implements Validator, OnChanges
{
   @Input() allowedNumericValues: string;
   private valFn = Validators.nullValidator;

   ngOnChanges( changes: SimpleChanges): void
   {
      const change = changes[ SELECTOR];
      if (change)
      {
         const val: string = change.currentValue;
         this.valFn = allowedNumericValuesValidator( val);
      }
      else
         this.valFn = Validators.nullValidator;
   }

   validate( control: AbstractControl): {[key: string]: any}
   {
      return this.valFn( control);
   }
}
