import { Component, OnInit } from '@angular/core';
import { Info } from 'src/CardInfo';
import data from '../../../assets/json/news.json';

@Component({
  selector: 'app-news-card',
  templateUrl: './news-card.component.html',
  styleUrls: ['./news-card.component.css']
})
export class NewsCardComponent implements OnInit {

  info: Info[] = data;

  constructor() { 
    console.log(this.info)
  }

  ngOnInit(): void {
  }

}
