import React from 'react';
import { Bell } from 'lucide-react';
import SearchInput from '../common/SearchInput';
import Button from '../common/Button';
import './TopBar.css';

const TopBar = ({ title, searchValue, onSearchChange }) => {
  return (
    <div className="topbar">
      <div className="topbar__left">
        <h1 className="topbar__title">{title}</h1>
      </div>
      
      <div className="topbar__right">
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search documents..."
        />
        <Button variant="ghost" className="topbar__notification">
          <Bell size={16} />
        </Button>
      </div>
    </div>
  );
};

export default TopBar;