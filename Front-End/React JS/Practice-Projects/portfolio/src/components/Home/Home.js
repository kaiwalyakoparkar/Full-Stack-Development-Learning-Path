import photo from "./profile.jpg"

export default function Home() {
	return (
		<div className="d-flex">
		  <div className="flex-shrink-0">
		    <img src={photo} alt="Profile Image" />
		  </div>
		  <div className="flex-grow-1 ms-3">
		    This is some content from a media component. You can replace this with any content and adjust it as needed.
		  </div>
		</div>
	)
}