import React, {useEffect, useState} from 'react';
import {BrowserRouter, Routes, Route} from "react-router-dom";
import Home from "./pages/Home";
import Statistics from "./pages/Statistics";
import Menu from "./components/Menu";
import "./styles/index.css"
import Default from "./pages/Default";

function App() {
    const [token, setToken] = useState("")
    const CLIENT_ID = "3acdcc4d613d4b0babf316734bfcd9aa";
    const REDIRECT_URI = "http://localhost:3000";
    const scopes = ['user-read-private', 'playlist-read-private', 'user-library-read', 'user-read-email', 'user-top-read'];
    const RESPONSE_TYPE  = "token";
    const AUTH_ENDPOINT = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${encodeURIComponent(scopes.join(' '))}`;
    
    useEffect(() => {
        const hash = window.location.hash
        let token = window.localStorage.getItem("token")
        
        if (!token && hash) {
            token = hash.substring(1).split("&").find(elem => elem.startsWith("access_token")).split("=")[1]
            
            window.location.hash = ""
            window.localStorage.setItem("token", token)
        }
        
        setToken(token)
    }, [])
    
    const logout = () => {
        setToken("")
        window.localStorage.removeItem("token")
    }
    
    const login = () => {
        window.location.href = AUTH_ENDPOINT
    }
    
    return (
        <BrowserRouter>
            <div className="App">
                <Menu token={token} login={login} logout={logout} />
                {!token ?
                    <Default/>
                    :
                    <Routes>
                        <Route path={"/"} element={<Home token={token}/>} />
                        <Route path={"/home"} element={<Home token={token}/>} />
                        <Route path={"/statistics"} element={<Statistics token={token}/>} />
                        <Route path={"*"} element={<Home token={token}/>} />
                    </Routes>
                }
            </div>
        </BrowserRouter>
    );
}

export default App;
