import photo from "./profile.jpg"

export default function Home() {
    return (
        <div className="d-flex align-items-center flex-wrap-reverse my-5">
        	<div className="flex-grow-1 ms-3">
        		<div>
        			<h2>Hello there, I am User XYZ 👋</h2>
        		</div>
				<div>
	        		<p>
	        			Lorem Ipsum is simply dummy text of the printing and typesetting industry. 
	        		</p>
	    		</div>
			</div>
          	<div className="flex-shrink-0 my-5 mx-5">
            	<img src={photo} width={350} height={350} alt="Profile of User" className="rounded-circle"/>
          	</div>
        </div>
    )
}