"use client";

import React, { useEffect, useState } from "react";
import { Container, Typography, List, ListItem, ListItemText, CircularProgress, Divider } from "@mui/material";

async function readResponse(response, fallback) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || fallback);
  return data;
}

export default function TablesExplorer() {
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
    Promise.all([
      fetch("/api/tables", { credentials: "include" }).then((response) => readResponse(response, "Failed to fetch tables")),
      fetch("/api/views", { credentials: "include" }).then((response) => readResponse(response, "Failed to fetch views")),
    ])
      .then(([tableData, viewData]) => {
        setTables(Array.isArray(tableData) ? tableData : []);
        setViews(Array.isArray(viewData) ? viewData : []);
      })
      .catch((loadError) => setError(loadError.message || "Unable to load database metadata"))
      .finally(() => {
        setLoading(false);
        setViewsLoading(false);
      });
  }, []);

  const handleTableClick = (table) => {
    setSelectedTable(table);
    setTableRows([]);
    setRowsLoading(true);
    setRowsError(null);
    fetch(`/api/table-values?schema=${encodeURIComponent(table.TABLE_SCHEMA)}&name=${encodeURIComponent(table.TABLE_NAME)}`, { credentials: "include" })
      .then((response) => readResponse(response, "Failed to fetch table values"))
      .then((data) => setTableRows(Array.isArray(data) ? data : []))
      .catch((loadError) => setRowsError(loadError.message || "Failed to fetch table values"))
      .finally(() => setRowsLoading(false));
  };

  const handleViewClick = (view) => {
    setSelectedView(view);
    setViewRows([]);
    setViewRowsLoading(true);
    setViewRowsError(null);
    fetch(`/api/table-values?schema=${encodeURIComponent(view.TABLE_SCHEMA)}&name=${encodeURIComponent(view.TABLE_NAME)}`, { credentials: "include" })
      .then((response) => readResponse(response, "Failed to fetch view values"))
      .then((data) => setViewRows(Array.isArray(data) ? data : []))
      .catch((loadError) => setViewRowsError(loadError.message || "Failed to fetch view values"))
      .finally(() => setViewRowsLoading(false));
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Database Tables</Typography>
      {loading ? <CircularProgress /> : error ? <Typography color="error">{error}</Typography> : (
        <>
          <List>
            {tables.map((table, index) => (
              <ListItem component="button" key={`${table.TABLE_SCHEMA}.${table.TABLE_NAME}-${index}`} onClick={() => handleTableClick(table)} selected={selectedTable === table}>
                <ListItemText primary={`${table.TABLE_SCHEMA}.${table.TABLE_NAME}`} />
              </ListItem>
            ))}
          </List>
          {selectedTable && (
            <Container maxWidth="md" sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>Values in {selectedTable.TABLE_SCHEMA}.{selectedTable.TABLE_NAME}</Typography>
              {rowsLoading ? <CircularProgress /> : rowsError ? <Typography color="error">{rowsError}</Typography> : tableRows.length === 0 ? <Typography>No rows found.</Typography> : (
                <List>{tableRows.map((row, index) => <ListItem key={index}><ListItemText primary={JSON.stringify(row)} /></ListItem>)}</List>
              )}
            </Container>
          )}

          <Divider sx={{ my: 4 }} />
          <Typography variant="h5" gutterBottom>Database Views</Typography>
          {viewsLoading ? <CircularProgress /> : viewsError ? <Typography color="error">{viewsError}</Typography> : (
            <List>
              {views.map((view, index) => (
                <ListItem component="button" key={`${view.TABLE_SCHEMA}.${view.TABLE_NAME}-${index}`} onClick={() => handleViewClick(view)} selected={selectedView === view}>
                  <ListItemText primary={`${view.TABLE_SCHEMA}.${view.TABLE_NAME}`} />
                </ListItem>
              ))}
            </List>
          )}
          {selectedView && (
            <Container maxWidth="md" sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>Values in {selectedView.TABLE_SCHEMA}.{selectedView.TABLE_NAME}</Typography>
              {viewRowsLoading ? <CircularProgress /> : viewRowsError ? <Typography color="error">{viewRowsError}</Typography> : viewRows.length === 0 ? <Typography>No rows found.</Typography> : (
                <List>{viewRows.map((row, index) => <ListItem key={index}><ListItemText primary={JSON.stringify(row)} /></ListItem>)}</List>
              )}
            </Container>
          )}
        </>
      )}
    </Container>
  );
}
