import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Todo } from 'src/app/Todo';

@Component({
  selector: 'app-todo-item',
  templateUrl: './todo-item.component.html',
  styleUrls: ['./todo-item.component.css']
})
export class TodoItemComponent implements OnInit {

  @Input() todo: Todo; //Taking input in module from todos
  @Output() todoDelete: EventEmitter<Todo> = new EventEmitter(); //Sending the reponse to delete the todo to todo.component.ts
  @Output() taskComplete: EventEmitter<Todo> = new EventEmitter();

  constructor() { }

  ngOnInit(): void {
  }

  onClick(todo:Todo) {
    //Using the eventemitter to emit the specified todo
    this.todoDelete.emit(todo);
    
    //Checking if todo object is received
    console.log(`Onclick triggered ${todo.sno}`);
  }

  onCheckboxClick(todo: Todo) {
    console.log(todo);
    this.taskComplete.emit(todo);
  }

}
