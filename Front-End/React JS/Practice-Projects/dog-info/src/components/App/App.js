// import useState, {useEffect} from 'react';
import axios from 'axios';
import './App.css';
import Navbar from '../Navbar/Navbar.js';
import Card from '../Card/Card.js';

export default async function App() {
  const dogs = (await axios.get("https://dog.ceo/api/breeds/image/random/3")).data.message;
  console.log(dogs);
  // const image = dogs.data.message;
  return (
    <div >
      <Navbar />
      {/*<Card imageLocation={}/>*/}
      {dogs.map(dog => {
        <Card imageLocation={dog[0]}/>
      })}
    </div>
  );
}

