import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import './PageWrapper.css';

const PageWrapper = ({ 
  title, 
  children, 
  searchValue, 
  onSearchChange,
  className = '' 
}) => {
  const classes = ['page-wrapper', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Sidebar />
      <TopBar 
        title={title} 
        searchValue={searchValue}
        onSearchChange={onSearchChange}
      />
      <main className="page-content">
        {children}
      </main>
    </div>
  );
};

export default PageWrapper;