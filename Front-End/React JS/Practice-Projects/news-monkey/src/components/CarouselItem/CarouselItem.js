export default function CarouselItem (props) {
	return (
		<div>
			<div className="carousel-item active">
		      <img src={props.imgSrc} className="d-block w-100" alt="..." />
		      <div className="carousel-caption d-none d-md-block">
		        <h5>{props.title}</h5>
		        <p>{props.desc}</p>
		      </div>
		    </div>
		</div>
	);
}