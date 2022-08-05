import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './MyComponents/navbar/navbar.component';
import { SlideCorouselComponent } from './MyComponents/slide-corousel/slide-corousel.component';
import { NewsCardComponent } from './MyComponents/news-card/news-card.component';
import { CardComponent } from './MyComponents/card/card.component';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    SlideCorouselComponent,
    NewsCardComponent,
    CardComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
