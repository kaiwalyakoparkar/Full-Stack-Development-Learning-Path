import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlideCorouselComponent } from './slide-corousel.component';

describe('SlideCorouselComponent', () => {
  let component: SlideCorouselComponent;
  let fixture: ComponentFixture<SlideCorouselComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SlideCorouselComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SlideCorouselComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
