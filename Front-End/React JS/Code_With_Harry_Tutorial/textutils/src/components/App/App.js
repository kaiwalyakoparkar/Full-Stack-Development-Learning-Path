import Navbar from '../Navbar/Navbar';
import TextForm from '../TextForm/TextForm'

function App() {
  return (
    <div>
      <Navbar title="Text Utils"/>

      <div className="container my-3">
        <TextForm heading="Enter your text to analyse"/>
      </div> 
    </div>
  );
}

export default App;