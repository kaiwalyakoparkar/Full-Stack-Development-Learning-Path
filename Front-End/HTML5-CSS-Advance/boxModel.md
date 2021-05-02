Everything in CSS has a box around it, and understanding these boxes is key to being able to create layouts with CSS, or to align items with other items. 
In this lesson, we will take a proper look at the CSS Box Model so that you can build more complex layout tasks with an understanding of how it works and the terminology that relates to it.

If a box is defined as a block, it will behave in the following ways:

- The box will break onto a new line.
- The box will extend in the inline direction to fill the space available in its container. 
- In most cases this means that the box will become as wide as its container, filling up 100% of the space available.
- The width and height properties are respected.
Padding, margin and border will cause other elements to be pushed away from the box

If a box has an outer display type of inline, then:

- The box will not break onto a new line.
- The width and height properties will not apply.
Vertical padding, margins, and borders will apply but will not cause other inline boxes to move away from the box.
- Horizontal padding, margins, and borders will apply and will cause other inline boxes to move away from the box.

Refer [this](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/The_box_model) for more information or watch [this](https://youtu.be/WlGQdgy-M6w) Yt video