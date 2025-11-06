CREATE VIEW MostChosenProducts AS
SELECT TOP 10
  PID,
  Name,
  Description,
  Price,
  Img AS imageUrl,
  ChosenCount
FROM Products_tbl
ORDER BY ChosenCount DESC;