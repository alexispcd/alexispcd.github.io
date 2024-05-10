import React from 'react';
import {Skeleton, TableBody, TableCell, TableRow} from "@mui/material";

const TableLoader = ({ colNumber }) => {
    return (
        <TableBody>
            {Array.from({ length: 20 }).map((_, index) => (
                <TableRow key={index}>
                    {Array.from({length: colNumber}).map((_, colIndex) => (
                        <TableCell key={colIndex}>
                            <Skeleton/>
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </TableBody>
    );
};

export default TableLoader;
