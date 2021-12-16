
import { Timeline } from 'primereact/timeline';
import './About.css';

export default function About() {

	const events = [
	    { status: 'Started Programming' },
	    { status: 'Attended a Coding BootCamp' },
	    { status: 'Learnt HTML and CSS' },
	    { status: 'Built first webpage' },
	    { status: 'Learnt NodeJS' },
	    { status: 'Built a simple NodeJS express Server' },
	    { status: 'Learnt about API' },
	    { status: 'Built a basic API of Student Data' }
	];

	return (
		<div className="card">
			<br />
			<h2 align="center">My Journey</h2>
			<br />
			<Timeline value={events} align="alternate" content={(item) => item.status} />
		</div>
	);
}