import React, {useEffect, useState} from 'react';
import {
    Avatar, Box,
    Card, CardActions, CardContent, Chip,
    FormControl, InputLabel, MenuItem, Pagination, Select, Slider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from "@mui/material";
import {getCurrentUserTopArtists} from "../../api/getApi";
import TableLoader from "../utils/TableLoader";
import Grid from '@mui/material/Unstable_Grid2';

const TopArtists = ({ token }) => {
    const [artistList, setArtistList] = useState([])
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const [timeRange, setTimeRange] = useState("long_term")
    const [offset, setOffset] = useState(0)
    const [limit, setLimit] = useState(10)
    
    useEffect(() => {
        setLoading(true)
        if (token) {
            getCurrentUserTopArtists(token, timeRange, limit, offset).then(data => {
                setArtistList(data)
            }).then(() => {
                setLoading(false)
            })
        } else {
            setArtistList([])
        }
    }, [token, timeRange, page, limit, offset])
    
    const handleTimeRangeChange = (e) => {
        setTimeRange(e.target.value);
    }
    
    const handleLimitChange = (e) => {
        setLimit(e.target.value)
    }
    
    const handlePagination = (event, value) => {
        setPage(value)
        setOffset((value - 1) * limit)
    }
    
    return (
        <Card className="statistics-card" elevation={24}>
            <CardContent>
                <Grid container className="statistics-card-filters">
                    <Grid xs={3}>
                        <FormControl>
                            <InputLabel id="demo-simple-select-label">Time Range</InputLabel>
                            <Select
                                labelId="demo-simple-select-label"
                                id="demo-simple-select"
                                value={timeRange}
                                label="Time Range"
                                onChange={handleTimeRangeChange}
                            >
                                <MenuItem value="short_term">Short term</MenuItem>
                                <MenuItem value="medium_term">Medium term</MenuItem>
                                <MenuItem value="long_term">Long term</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid xs={3}>
                        <Box sx={{ maxWidth: 200}}>
                            <Slider
                                aria-label="Limit"
                                defaultValue={limit}
                                valueLabelDisplay="auto"
                                shiftStep={30}
                                step={10}
                                marks
                                min={10}
                                max={50}
                                onChange={handleLimitChange}
                                
                            />
                        </Box>
                    </Grid>
                </Grid>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Rank</TableCell>
                                <TableCell></TableCell>
                                <TableCell>Artist</TableCell>
                                <TableCell>Genres</TableCell>
                                <TableCell>Popularity</TableCell>
                            </TableRow>
                        </TableHead>
                        {loading ?
                            <TableLoader colNumber={5}/>
                            :
                            <TableBody>
                                {artistList.items && artistList.items.map((artist, index) => (
                                    <TableRow key={artist.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                        <TableCell>{index + 1 + ((page - 1) * limit)}</TableCell>
                                        <TableCell>
                                            <Avatar sx={{ width: 56, height: 56 }} src={artist.images[2].url} />
                                        </TableCell>
                                        <TableCell>{artist.name}</TableCell>
                                        <TableCell>
                                            <div className="statistics-genres">
                                                {artist.genres.map((genre) => <Chip className="statistics-genre" label={genre}/>)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{artist.popularity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        }
                    </Table>
                </TableContainer>
            </CardContent>
            <CardActions>
                <Pagination count={Math.ceil(artistList.total / limit)} page={page} onChange={handlePagination} />
            </CardActions>
        </Card>
    );
};

export default TopArtists;