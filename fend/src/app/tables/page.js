"use client";
import React, { useEffect, useState } from "react";
import { Container, Typography, List, ListItem, ListItemText, CircularProgress, Divider } from "@mui/material";
import Header from "../components/Header";

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState(null);

  const [views, setViews] = useState([]);
  const [viewsLoading, setViewsLoading] = useState(true);
  const [viewsError, setViewsError] = useState(null);
  const [selectedView, setSelectedView] = useState(null);
  const [viewRows, setViewRows] = useState([]);
  const [viewRowsLoading, setViewRowsLoading] = useState(false);
  const [viewRowsError, setViewRowsError] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/tables")
      .then((res) => res.json())
      .then((data) => {
        setTables(data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to fetch tables");
        setLoading(false);
      });

    fetch("http://localhost:5000/api/views")
      .then((res) => res.json())
      .then((data) => {
        setViews(data);
        setViewsLoading(false);
      })
      .catch((err) => {
        setViewsError("Failed to fetch views");
        setViewsLoading(false);
      });
  }, []);
  // Fetch view values when a view is selected
  const handleViewClick = (view) => {
    setSelectedView(view);
    setViewRows([]);
    setViewRowsLoading(true);
    setViewRowsError(null);
    fetch(`http://localhost:5000/api/table-values?schema=${view.TABLE_SCHEMA}&name=${view.TABLE_NAME}`)
      .then((res) => res.json())
      .then((data) => {
        setViewRows(data);
        setViewRowsLoading(false);
      })
      .catch((err) => {
        setViewRowsError("Failed to fetch view values");
        setViewRowsLoading(false);
      });
  };

  // Fetch table values when a table is selected
  const handleTableClick = (table) => {
    setSelectedTable(table);
    setTableRows([]);
    setRowsLoading(true);
    setRowsError(null);
    fetch(`http://localhost:5000/api/table-values?schema=${table.TABLE_SCHEMA}&name=${table.TABLE_NAME}`)
      .then((res) => res.json())
      .then((data) => {
        setTableRows(data);
        setRowsLoading(false);
      })
      .catch((err) => {
        setRowsError("Failed to fetch table values");
        setRowsLoading(false);
      });
  };

  return (
    <>
      {/* <Header /> */}
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Database Tables
        </Typography>
        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <>
            <List>
              {Array.isArray(tables) && tables.map((table, idx) => (
                <ListItem component="button" key={idx} onClick={() => handleTableClick(table)} selected={selectedTable === table}>
                  <ListItemText primary={`${table.TABLE_SCHEMA}.${table.TABLE_NAME}`} />
                </ListItem>
              ))}
            </List>
            {/* Show table values if a table is selected */}
            {selectedTable && (
              <Container maxWidth="md" sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Values in {selectedTable.TABLE_SCHEMA}.{selectedTable.TABLE_NAME}
                </Typography>
                {rowsLoading ? (
                  <CircularProgress />
                ) : rowsError ? (
                  <Typography color="error">{rowsError}</Typography>
                ) : tableRows.length === 0 ? (
                  <Typography>No rows found.</Typography>
                ) : (
                  <List>
                    {tableRows.map((row, idx) => (
                      <ListItem key={idx}>
                        <ListItemText primary={JSON.stringify(row)} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Container>
            )}

            <Divider sx={{ my: 4 }} />
            <Typography variant="h5" gutterBottom>
              Database Views
            </Typography>
            {viewsLoading ? (
              <CircularProgress />
            ) : viewsError ? (
              <Typography color="error">{viewsError}</Typography>
            ) : (
              <List>
                {views.map((view, idx) => (
                  <ListItem component="button" key={idx} onClick={() => handleViewClick(view)} selected={selectedView === view}>
                    <ListItemText primary={`${view.TABLE_SCHEMA}.${view.TABLE_NAME}`} />
                  </ListItem>
                ))}
              </List>
            )}
            {/* Show view values if a view is selected */}
            {selectedView && (
              <Container maxWidth="md" sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Values in {selectedView.TABLE_SCHEMA}.{selectedView.TABLE_NAME}
                </Typography>
                {viewRowsLoading ? (
                  <CircularProgress />
                ) : viewRowsError ? (
                  <Typography color="error">{viewRowsError}</Typography>
                ) : viewRows.length === 0 ? (
                  <Typography>No rows found.</Typography>
                ) : (
                  <List>
                    {viewRows.map((row, idx) => (
                      <ListItem key={idx}>
                        <ListItemText primary={JSON.stringify(row)} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Container>
            )}
          </>
        )}
      </Container>
    </>
  );
}
