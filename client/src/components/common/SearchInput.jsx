import React from 'react';
import { Search } from 'lucide-react';
import './SearchInput.css';

const SearchInput = ({ 
  placeholder = "Search documents...",
  value,
  onChange,
  className = '',
  ...props 
}) => {
  const classes = ['search-input', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Search className="search-input__icon" size={14} />
      <input
        type="text"
        className="search-input__field"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        {...props}
      />
    </div>
  );
};

export default SearchInput;