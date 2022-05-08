import chat_image from "../../Assets/Images/chat.svg"

export default function Landing() {
    return (
        <div className="flex bg-indigo-900 text-white h-screen rounded-lg p-8">

            <div className="flex-row w-3/4 m-4">

                <div className="text-6xl mb-8">
                    Live chat support for your customers.
                </div>

                <div className="text-xl mb-8">
                    Create custom landing pages with CompanyZ that convert <br /> more visitors than any website—no coding required.
                </div>

                <div className="flex mb-8">
                    <input type="email" placeholder="you@example.com" className="mr-8 mt-1 px-3 py-2 bg-white text-xl border shadow-sm text-indigo-900 border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 block w-80 h-14 rounded-md sm:text-sm focus:ring-1" />
                    <div className="text-indigo-900 cursor-pointer pt-4 pl-9 w-32 justify-center bg-indigo-200 hover:bg-amber-400 transition duration-100 ease-out hover:ease-in rounded-lg font-bold">Submit</div>
                </div>

                <div>
                    Already using CompanyZ? <span className="cursor-pointer text-amber-400 ml-2">Sign In</span>
                </div>

            </div>

            <div >
                <img src={chat_image} alt="people chatting live online"/>
            </div>

        </div>
    )
}