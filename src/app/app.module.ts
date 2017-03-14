import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { RouterModule }   from '@angular/router';

import { SharedModule } from './shared/shared.module';
import { AppComponent } from './app.component';
import { ClusterDetailsComponent } from './cluster-details/cluster-details.component';
import { GeneratorParamsComponent } from './generator-params/generator-params.component';
import { TabsComponent } from './tabs/tabs.component';
import { XmlComponent } from './xml/xml.component';
import { SessionOpsComponent } from './session-ops/session-ops.component';

@NgModule({
   declarations: [
      AppComponent,
      ClusterDetailsComponent,
      GeneratorParamsComponent,
      TabsComponent,
      XmlComponent,
      SessionOpsComponent
   ],
   imports: [
      BrowserModule,
      FormsModule,
      HttpModule,
      SharedModule,
      RouterModule.forRoot([
         {
            path: '',           // Initial load.
            redirectTo: '/params',
            pathMatch: 'full'
         },
         {
            path: 'params',
            component: GeneratorParamsComponent
         },
         {
            path: 'details',
            component: ClusterDetailsComponent
         },
         {
            path: 'xml',
            component: XmlComponent
         },
         {
            path: 'session-ops',
            component: SessionOpsComponent
         }
      ])
   ],
   providers: [],
   bootstrap: [AppComponent]
})
export class AppModule { }
