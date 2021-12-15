import './Home.css';
import programmerImage from '../../assets/images/programmer.jpg'

export default function Home() {
	return (
		<div className="homeContainer">
			<img className="profile-image" alt="Programmer profile" src={programmerImage}/>
			<div className="textArea">
				<h1 className="titleName">Programmer</h1>
				<p className="info-paragraph">Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.</p>
			</div>
		</div>
	)
}