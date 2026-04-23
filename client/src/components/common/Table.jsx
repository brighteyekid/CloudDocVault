import React from 'react';
import './Table.css';

const Table = ({ 
  columns, 
  data, 
  className = '',
  onRowClick,
  ...props 
}) => {
  const classes = ['table', className].filter(Boolean).join(' ');

  return (
    <div className="table-container">
      <table className={classes} {...props}>
        <thead className="table__header">
          <tr>
            {columns.map((column, index) => (
              <th 
                key={column.key || index} 
                className="table__header-cell"
                style={{ width: column.width }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="table__body">
          {data.map((row, rowIndex) => (
            <tr 
              key={row.id || rowIndex} 
              className={`table__row ${onRowClick ? 'table__row--clickable' : ''}`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((column, colIndex) => (
                <td 
                  key={column.key || colIndex} 
                  className="table__cell"
                >
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;