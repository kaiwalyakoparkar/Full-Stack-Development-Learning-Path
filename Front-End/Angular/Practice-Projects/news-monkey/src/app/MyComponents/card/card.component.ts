import { Component, Input, OnInit } from '@angular/core';
import { Info } from 'src/CardInfo';

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css']
})
export class CardComponent implements OnInit {

  @Input() info: Info; //Taking input in module from todos

  constructor() { }

  ngOnInit(): void {
  }

}
