export default function Navbar() {
    return (
        <div className="bg-indigo-900 text-white p-2 h-16 rounded-lg flex">
            <div className="flex w-4/5">
                <h1 className="mx-5 p-2 text-2xl">Navbar</h1>
            </div>
            <div className="flex space-x-10 p-2 text-lg">
                <p className="cursor-pointer hover:text-amber-400 transition duration-150 ease-out hover:ease-in">Home</p>
                <p className="cursor-pointer hover:text-amber-400 transition duration-150 ease-out hover:ease-in">About</p>
                <p className="cursor-pointer hover:text-amber-400 transition duration-150 ease-out hover:ease-in">Contact</p>
            </div>
        </div>
    )
}