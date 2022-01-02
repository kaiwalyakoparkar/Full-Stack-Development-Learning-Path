import './Card.css';

export default function Card(props) {
	return (
		<div>
			<div className="card">
			  <img className="card-img-top" src={props.imageLocation} alt="Card cap" />
			</div>
		</div>
	)
}