import React, { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import api from '../../services/api';
import './VaultGraph.css';

const VaultGraph = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fgRef = useRef();

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const response = await api.get('/documents/graph/data');
        setGraphData(response.data);
      } catch (err) {
        setError(err.message || 'Failed to load intelligence graph');
      } finally {
        setLoading(false);
      }
    };
    fetchGraph();
  }, []);

  const handleNodeClick = useCallback(node => {
    if(fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(8, 2000);
    }
  }, [fgRef]);

  if (loading) return <div className="graph-loading"><div className="btn__spinner" /> Loading Intelligence Nexus...</div>;
  if (error) return <div className="graph-error">{error}</div>;

  return (
    <div className="vault-graph-container wow-fade-in">
      <div className="vault-graph-header">
        <h1 className="wow-gradient-text">Vault Intelligence Nexus</h1>
        <p>A semantic web connecting your documents through AI-extracted entities.</p>
      </div>
      <div className="vault-graph-canvas">
        <ForceGraph2D
          ref={fgRef}
          width={window.innerWidth - 300}
          height={window.innerHeight - 180}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={node => node.group === 1 ? '#4F8EF7' : '#22D3EE'}
          linkColor={() => 'rgba(255, 255, 255, 0.2)'}
          linkWidth={1.5}
          nodeRelSize={6}
          onNodeClick={handleNodeClick}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.name;
            const fontSize = node.group === 1 ? 14/globalScale : 11/globalScale;
            ctx.font = `${fontSize}px var(--font-heading)`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

            ctx.fillStyle = 'rgba(11, 14, 26, 0.85)';
            ctx.beginPath();
            ctx.roundRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1], 4);
            ctx.fill();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = node.group === 1 ? '#4F8EF7' : '#22D3EE';
            ctx.fillText(label, node.x, node.y);

            node.__bckgDimensions = bckgDimensions;
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            const bckgDimensions = node.__bckgDimensions;
            bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
          }}
        />
      </div>
    </div>
  );
};

export default VaultGraph;
