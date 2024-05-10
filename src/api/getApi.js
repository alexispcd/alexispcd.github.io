import axios from "axios";

export async function getArtistSearch(token, search) {
    const {data} = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
            Authorization: `Bearer ${token}`
        },
        params: {
            q: search,
            type: "artist"
        }
    });
    
    return data;
}

export async function getCurrentUser(token) {
    const {data} = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    
    return data;
}

export async function getCurrentUserTopTracks(token, timeRange = 'short_term', offset = 0) {
    const {data} = await axios.get(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=10&offset=${offset}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
    
    return data
}

export async function getCurrentUserTopArtists(token, timeRange, limit, offset) {
    const {data} = await axios.get(`https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=${limit}&offset=${offset}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
    
    return data
}