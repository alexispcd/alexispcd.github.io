import React, {useEffect, useState} from 'react';
import {AppBar, Avatar, Box, IconButton, Toolbar, Tooltip, Typography} from "@mui/material";
import {getCurrentUser} from "../api/getApi";
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import {NavLink} from "react-router-dom";

const Menu = ({ token, login, logout }) => {
    const [user, setUser] = useState(null)
    
    useEffect(() => {
        if (token) {
            getCurrentUser(token).then(data => {
                setUser(data)
            })
        } else {
            setUser(null)
        }
    }, [token])
    
    return (
        <Box>
            <AppBar position="relative">
                <Toolbar className="toolbar">
                    {token && user ?
                        <>
                            <Typography variant="h3" component="h1">
                                meloflow
                            </Typography>
                            <Box className="toolbar-menu" sx={{ flexGrow: 1 }}>
                                <NavLink className={({ isActive }) => `toolbar-menu-item ${isActive ? "active" : ""}`} to={"/home"}>
                                    <Typography variant="h5">
                                        Home
                                    </Typography>
                                </NavLink>
                                <NavLink className={({ isActive }) => `toolbar-menu-item ${isActive ? "active" : ""}`} to={"/statistics"}>
                                    <Typography variant="h5">
                                        Statistics
                                    </Typography>
                                </NavLink>
                            </Box>
                            <Box className="user-menu">
                                <Avatar alt={user.display_name} src={user.images[0].url} />
                                <Typography variant="h6" className="user-name">{user.display_name}</Typography>
                                <Tooltip title="Log out">
                                    <IconButton onClick={logout}>
                                        <LogoutIcon/>
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </>
                        :
                        <>
                            <Typography variant="h3" component="h1" sx={{ flexGrow: 1 }}>
                                meloflow
                            </Typography>
                            <div className="user-menu">
                                <Tooltip title="Log in">
                                    <IconButton onClick={login}>
                                        <LoginIcon/>
                                    </IconButton>
                                </Tooltip>
                            </div>
                        </>
                    }
                </Toolbar>
            </AppBar>
        </Box>
    );
};

export default Menu;