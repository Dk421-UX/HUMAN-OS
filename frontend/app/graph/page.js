'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Info, ArrowRight, HelpCircle, Sparkles, ZoomIn, ZoomOut, Maximize, Eye } from 'lucide-react';
import { api } from '@/utils/api';

const INITIAL_POSITIONS = {
  'Fear of Failure': { x: 120, y: 110 },
  'Perfectionism': { x: 300, y: 110 },
  'Avoidance': { x: 480, y: 110 },
  'Procrastination': { x: 620, y: 170 },
  'People Pleasing': { x: 120, y: 290 },
  'Conflict Avoidance': { x: 300, y: 290 },
  'Self Criticism': { x: 480, y: 290 }
};

const DOSSIER_MAPPING = {
  'Fear of Failure': {
    why: 'It exists to protect your self-esteem by equating performance outcomes directly with personal worth. If you do not finish or submit, you cannot be judged as inadequate.',
    feeds: 'Anticipation of critique, high-stakes tasks, and memories of past evaluation discomfort.',
    creates: 'Erects extreme preparation requirements, feeds Perfectionism, and drives Avoidance loops.',
    strengthens: 'Postponing work to seek more information, which gives short-term safety but reinforces the core fear of failure.',
    weakens: 'Submitting drafts before they are finished, exposing yourself to minor critiques, and reframing mistakes as neutral feedback.',
    change: 'Currently stable. It rises when project visibility increases and declines as you practice action without guarantees.'
  },
  'Perfectionism': {
    why: 'It exists as a standard standard shield: by demanding that work must be flawless, you keep it safely hidden in a preparation phase, immune from judgment.',
    feeds: 'Fear of Failure, high standards, and standard criticism loops.',
    creates: 'Procrastination, overthinking, and avoidance of task completion.',
    strengthens: 'Spending hours polishing minor details, slide formatting, or code comments instead of testing the core functionality.',
    weakens: 'Sharing a half-finished layout or draft early and collecting feedback while standard criteria are still flexible.',
    change: 'Observing minor fluctuations. Shows activity when standards are rigid and declines as boundary strength grows.'
  },
  'Avoidance': {
    why: 'It exists as an immediate anxiety regulator: by walking away from high-stakes decisions, your nervous system experiences short-term relief from tension.',
    feeds: 'Perfectionism, over-preparation, and fear of negative feedback.',
    creates: 'Unfinished projects, last-minute rushes, and missed professional opportunities.',
    strengthens: 'Choosing low-stakes tasks (like cleaning your inbox or organizing files) over primary project tasks.',
    weakens: 'Working on the primary task for exactly 15 minutes without any research materials allowed.',
    change: 'Declining slightly as your self-trust indices improve across recent reflections.'
  },
  'Overthinking Loops': {
    why: 'It exists to simulate safety: the mind believes that if it processes every possible scenario, it can eliminate the risk of a wrong choice.',
    feeds: 'Need for guarantees, multiple options, and fear of regret.',
    creates: 'Decision gridlock, mental fatigue, and loss of behavioral momentum.',
    strengthens: 'Doing additional research or asking multiple people for advice before committing.',
    weakens: 'Making minor decisions within a 3-minute limit using a coin flip or first-instinct default.',
    change: 'Currently stable. Remains central when open-ended outcomes are present.'
  },
  'People Pleasing': {
    why: 'It exists to secure connection and belonging: by saying yes to others, you minimize the risk of relational friction and disapproval.',
    feeds: 'Fear of rejection, compliance defaults, and other-oriented focus.',
    creates: 'Exhaustion, quiet resentment, and progressive decay of authentic limits.',
    strengthens: 'Smiling and agreeing to accommodating requests immediately without checking capacity.',
    weakens: 'Stating "I need to check capacity first" and delaying responses by at least 10 minutes.',
    change: 'Stable. Shows activity during high relational contact periods.'
  },
  'Conflict Avoidance': {
    why: 'It exists to prevent relational disruption: your nervous system treats differences of opinion as immediate threats to safety.',
    feeds: 'People Pleasing, fear of rejection, and past conflict discomfort.',
    creates: 'Artificial peace, withheld boundary limits, and hidden relationship friction.',
    strengthens: 'Staying silent or accommodating during a disagreement to restore peace quickly.',
    weakens: 'Expressing a different preference politely: "I have a different read of this scenario."',
    change: 'Calibrating. Remains active when relational stakes are high.'
  },
  'Self Criticism': {
    why: 'It exists as a harsh hyper-vigilant audit: the critic believes that severe self-punishment will motivate you to perform better next time.',
    feeds: 'Perfectionism, perceived mistakes, and standard criticism defaults.',
    creates: 'Diminished self-trust, exhaustion, and elevated baseline anxiety.',
    strengthens: 'Replaying past mistakes in your mind and accepting the critical voice as truth.',
    weakens: 'Writing down the critic\'s claims and countering them with objective evidence.',
    change: 'Rises when tasks are delayed and settles as self-compassion practices are introduced.'
  },
  default: {
    why: 'It exists as a protection mechanism to shield you from immediate emotional discomfort and vulnerability.',
    feeds: 'Uncertainty, evaluation pressure, and habit default loops.',
    creates: 'Coping shields and repeated behaviors across reflections.',
    strengthens: 'Living inside the loop without naming it or acknowledging its long-term cost.',
    weakens: 'Observing the loop objectively as it is happening and trying one minor alternative action.',
    change: 'A stable coping style that is starting to register increased user awareness.'
  }
};

export default function GraphPage() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightedConnections, setHighlightedConnections] = useState({ incoming: [], outgoing: [] });
  const [dragNodeId, setDragNodeId] = useState(null);
  const [error, setError] = useState('');

  // V4 Interactive states
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Zoom and Pan states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const svgRef = useRef(null);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const [graphData, patternsData] = await Promise.all([
          api.getGraph(),
          api.getPatterns()
        ]);
        
        const rawNodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
        const rawLinks = Array.isArray(graphData?.links) ? graphData.links : [];

        // Form nodes with coordinates
        const mappedNodes = rawNodes.map((node, idx) => {
          const defaultPos = INITIAL_POSITIONS[node?.id] || {
            x: 150 + (idx * 90) % 400,
            y: 120 + (idx * 60) % 200
          };
          return { ...node, x: defaultPos.x, y: defaultPos.y };
        });

        setNodes(mappedNodes);
        setLinks(rawLinks);
        setPatterns(Array.isArray(patternsData) ? patternsData : []);
      } catch (err) {
        console.error(err);
        setError('Sandbox interactive graph.');
        // Seed fallback data for sandboxed mode
        const mockNodes = [
          { id: 'Fear of Failure', score: 82, confidence: 91, category: 'Cognitive', x: 120, y: 110 },
          { id: 'Perfectionism', score: 85, confidence: 89, category: 'Behavioral', x: 300, y: 110 },
          { id: 'Avoidance', score: 78, confidence: 85, category: 'Decision-making', x: 480, y: 110 },
          { id: 'Procrastination', score: 74, confidence: 80, category: 'Behavioral', x: 620, y: 170 },
          { id: 'People Pleasing', score: 71, confidence: 88, category: 'Behavioral', x: 120, y: 290 },
          { id: 'Conflict Avoidance', score: 75, confidence: 84, category: 'Decision-making', x: 300, y: 290 },
          { id: 'Self Criticism', score: 89, confidence: 92, category: 'Emotional', x: 480, y: 290 }
        ];

        const mockLinks = [
          { source: 'Fear of Failure', target: 'Perfectionism', weight: 85 },
          { source: 'Perfectionism', target: 'Avoidance', weight: 78 },
          { source: 'Avoidance', target: 'Procrastination', weight: 92 },
          { source: 'People Pleasing', target: 'Conflict Avoidance', weight: 80 }
        ];

        setNodes(mockNodes);
        setLinks(mockLinks);

        const mockPatterns = mockNodes.map(n => ({
          name: n.id,
          firstSeen: '2026-06-01T12:00:00Z',
          lastSeen: '2026-06-05T12:00:00Z',
          occurrences: 4,
          trend: n.score > 80 ? 'Increasing' : 'Stable',
          trendVelocity: n.score > 80 ? 5 : 0,
          contexts: ['Career', 'Productivity'],
          relatedPatterns: ['Perfectionism', 'Avoidance'],
          evolutionStory: `This pattern represents a core defensive stance when facing evaluation boundaries. You are learning to observe the connection bridges.`
        }));
        setPatterns(mockPatterns);
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, []);

  // Update connection selections based on active node click
  const selectNode = (node) => {
    if (!node) return;
    if (selectedNode?.id === node.id) {
      setSelectedNode(null);
      setHighlightedConnections({ incoming: [], outgoing: [] });
      return;
    }
    setSelectedNode(node);
    const incoming = (links || []).filter(l => l?.target === node.id).map(l => l?.source).filter(Boolean);
    const outgoing = (links || []).filter(l => l?.source === node.id).map(l => l?.target).filter(Boolean);
    setHighlightedConnections({ incoming, outgoing });
  };

  const getSvgPoint = (event) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    return {
      x: ((event.clientX - rect.left) / rect.width) * 700,
      y: ((event.clientY - rect.top) / rect.height) * 400
    };
  };

  const getNodeLabelLines = (label) => {
    const words = String(label || '').split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length > 14 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 2);
  };

  const handlePointerDown = (nodeId, e) => {
    if (!nodeId) return;
    e.stopPropagation();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    setDragNodeId(nodeId);
  };

  const handleBgPointerDown = (e) => {
    e.preventDefault();
    const point = getSvgPoint(e);
    if (!point) return;
    
    setIsPanning(true);
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    setPanStart({
      x: point.x - pan.x,
      y: point.y - pan.y
    });
  };

  const handlePointerMove = (e) => {
    const point = getSvgPoint(e);
    if (!point) return;

    if (dragNodeId && svgRef.current) {
      const x = Math.min(640, Math.max(60, (point.x - pan.x) / zoom));
      const y = Math.min(360, Math.max(25, (point.y - pan.y) / zoom));

      setNodes(prev => (prev || []).map(n => n.id === dragNodeId ? { ...n, x, y } : n));
    } else if (isPanning) {
      setPan({
        x: point.x - panStart.x,
        y: point.y - panStart.y
      });
    }
  };

  const handlePointerUp = () => {
    setDragNodeId(null);
    setIsPanning(false);
  };

  const handleZoom = (factor) => {
    setZoom(prev => Math.min(3, Math.max(0.5, prev * factor)));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const getLinkColor = (link) => {
    if (isFocusMode && selectedNode) {
      const isSelected = selectedNode.id === link.source || selectedNode.id === link.target;
      return isSelected ? '#6EE7FF' : 'rgba(255, 255, 255, 0.01)';
    }

    if (!selectedNode || !link) return 'rgba(255, 255, 255, 0.05)';
    if (selectedNode.id === link.source) return '#6EE7FF'; // primary outgoing path
    if (selectedNode.id === link.target) return 'rgba(110, 231, 255, 0.4)'; // incoming path
    return 'rgba(255, 255, 255, 0.01)'; // muted
  };

  const getNodeOpacity = (node) => {
    if (isFocusMode && selectedNode) {
      if (selectedNode.id === node.id) return 1;
      const isIncoming = (highlightedConnections?.incoming || []).includes(node.id);
      const isOutgoing = (highlightedConnections?.outgoing || []).includes(node.id);
      return isIncoming || isOutgoing ? 0.85 : 0.02;
    }

    if (!selectedNode || !node) return 1;
    if (selectedNode.id === node.id) return 1;
    
    const isIncoming = (highlightedConnections?.incoming || []).includes(node.id);
    const isOutgoing = (highlightedConnections?.outgoing || []).includes(node.id);
    
    return isIncoming || isOutgoing ? 0.85 : 0.25;
  };

  const getPatternDesc = (name) => {
    const desc = {
      'Fear of Failure': 'Equating flawless execution with capability; establishing extreme preparation stages to avoid risk of exposure.',
      'Perfectionism': 'Erecting rigid boundaries of high standards to defer the final completion and evaluation of projects.',
      'Avoidance': 'Bypassing high-stakes scenarios or judgments to keep your internal identity safe from perceived failure.',
      'Procrastination': 'Substituting real, direct action with preparative research to delay actual vulnerability.',
      'People Pleasing': 'Deferring boundary declarations to prioritize the comfort of others and manage abandonment anxiety.',
      'Conflict Avoidance': 'Repressing assertions or boundaries to avoid immediate interpersonal friction or disapproval.',
      'Self Criticism': 'Using severe internal audits to evaluate performance, creating a loop of diminished trust.',
      'Overthinking Loops': 'Postponing real decisions and actions by keeping yourself in endless cycles of analytical processing.'
    };
    return desc[name] || 'A repeating loop identified in dialogues.';
  };

  const selectedPatternDetails = patterns.find(p => p.name === selectedNode?.id);

  return (
    <div 
      className="w-full flex-1 flex flex-col gap-8 py-6 pb-24" 
      onPointerUp={handlePointerUp} 
      onPointerCancel={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      
      {/* CSS dash animation style for Loop pathways */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -40;
          }
        }
        .loop-pathway-animated {
          stroke-dasharray: 8, 8;
          animation: dash 1.5s linear infinite;
        }
      `}</style>

      {/* Page Header */}
      <div>
        <span className="text-[10px] uppercase tracking-[0.25em] text-[#71717A] font-semibold">
          Neural System
        </span>
        <h2 className="text-3xl font-light tracking-[0.08em] text-white mt-1 uppercase font-serif">
          Pattern Graph
        </h2>
        <p className="text-xs text-[#A1A1AA] font-light mt-2 max-w-xl leading-relaxed">
          An interactive, draggable canvas mapping how core cognitive styles flow together to generate outcomes. Drag nodes to reshape your profile.
        </p>
        {error && (
          <div className="mt-4 inline-flex rounded-full border border-[#6EE7FF]/15 bg-[#6EE7FF]/5 px-3 py-1 text-[10px] font-medium uppercase text-[#6EE7FF]">
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16 flex-1">
          <div className="w-8 h-8 rounded-full border border-white/5 border-t-[#6EE7FF] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* Draggable SVG Graph Area (Left - 3 columns) */}
          <div className="lg:col-span-3 premium-glass rounded-2xl p-4 md:p-6 overflow-hidden relative shadow-[0_24px_50px_rgba(0,0,0,0.8)]">
            
            <div 
              className="w-full aspect-[7/4] max-h-[480px] bg-[#050505]/60 rounded-xl relative border border-white/5 cursor-grab active:cursor-grabbing select-none overflow-hidden"
              onPointerDown={handleBgPointerDown}
              style={{ touchAction: 'none' }}
            >
              
              {/* Focus Mode Trigger */}
              <div className="absolute top-4 left-4 flex gap-2 z-20">
                <button
                  type="button"
                  onClick={() => setIsFocusMode(!isFocusMode)}
                  className={`min-h-11 px-4 py-2 rounded-full border text-[9px] uppercase tracking-wider font-semibold transition-all duration-300 ${
                    isFocusMode 
                      ? 'bg-[#6EE7FF]/10 border-[#6EE7FF]/30 text-[#6EE7FF] shadow-[0_0_12px_rgba(110,231,255,0.1)]' 
                      : 'bg-black/60 border-white/10 text-[#71717A] hover:text-[#A1A1AA]'
                  }`}
                >
                  {isFocusMode ? 'Focus: Active' : 'Focus Mode'}
                </button>
              </div>

              {/* Zoom & Reset Buttons */}
              <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={(e) => { e.stopPropagation(); handleZoom(1.2); }}
                  className="min-h-11 min-w-11 p-2 rounded bg-black/60 border border-white/10 hover:border-white/20 text-[#71717A] hover:text-[#6EE7FF] transition-all duration-300"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={(e) => { e.stopPropagation(); handleZoom(0.8); }}
                  className="min-h-11 min-w-11 p-2 rounded bg-black/60 border border-white/10 hover:border-white/20 text-[#71717A] hover:text-[#6EE7FF] transition-all duration-300"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Reset graph view"
                  onClick={(e) => { e.stopPropagation(); handleResetZoom(); }}
                  className="min-h-11 min-w-11 p-2 rounded bg-black/60 border border-white/10 hover:border-white/20 text-[#71717A] hover:text-[#6EE7FF] transition-all duration-300"
                  title="Reset View"
                >
                  <Maximize size={14} />
                </button>
              </div>

              {/* Floating particles drifts */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
                <div className="absolute w-2 h-2 rounded-full bg-[#6EE7FF] top-[15%] left-[20%] animate-float-drift" style={{ animationDelay: '0s' }} />
                <div className="absolute w-3 h-3 rounded-full bg-[#6EE7FF] top-[65%] left-[45%] animate-float-drift" style={{ animationDelay: '1.5s' }} />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-[#6EE7FF] top-[40%] left-[80%] animate-float-drift" style={{ animationDelay: '3s' }} />
              </div>

              <svg 
                ref={svgRef}
                className="w-full h-full" 
                viewBox="0 0 700 400"
                preserveAspectRatio="xMidYMid meet"
              >
                {(nodes || []).length === 0 && (
                  <text x="350" y="200" fill="rgba(255,255,255,0.45)" fontSize="12" textAnchor="middle">
                    No pattern graph yet. Reflect once to create the first node.
                  </text>
                )}

                {/* Transform Wrapper Group for Zoom & Pan */}
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transition: isPanning ? 'none' : 'transform 0.1s ease-out' }}>
                  
                  {/* SVG Connections */}
                  <g>
                    {(links || []).map((link, idx) => {
                      const sourceNode = (nodes || []).find(n => n?.id === link?.source);
                      const targetNode = (nodes || []).find(n => n?.id === link?.target);
                      if (!sourceNode || !targetNode) return null;

                      const color = getLinkColor(link);
                      const isSelectedPath = selectedNode && (selectedNode.id === link.source || selectedNode.id === link.target);
                      const isLoop = link.weight >= 75;

                      // Base path width maps to weight
                      const pathWidth = isSelectedPath ? 3.5 : Math.max(1.5, (link.weight || 50) / 25);

                      // Hide links of unfocused elements in Focus Mode
                      const linkOpacity = isFocusMode && selectedNode 
                        ? (selectedNode.id === link.source || selectedNode.id === link.target ? 0.9 : 0.01)
                        : (selectedNode ? (isSelectedPath ? 0.9 : 0.05) : 0.4);

                      return (
                        <g key={idx} style={{ opacity: linkOpacity, transition: 'opacity 0.4s ease' }}>
                          {/* Static connecting line */}
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={color}
                            strokeWidth={pathWidth}
                            className="transition-all duration-300"
                          />
                          {/* Running dashes along loop pathways (weight >= 75) */}
                          {isLoop && (
                            <line
                              x1={sourceNode.x}
                              y1={sourceNode.y}
                              x2={targetNode.x}
                              y2={targetNode.y}
                              stroke="#6EE7FF"
                              strokeWidth={pathWidth}
                              strokeLinecap="round"
                              className="loop-pathway-animated"
                              opacity={0.3}
                            />
                          )}
                          {/* Running dashes along selected connections */}
                          {isSelectedPath && (
                            <line
                              x1={sourceNode.x}
                              y1={sourceNode.y}
                              x2={targetNode.x}
                              y2={targetNode.y}
                              stroke="#6EE7FF"
                              strokeWidth={pathWidth + 0.8}
                              strokeLinecap="round"
                              className="loop-pathway-animated"
                              style={{
                                filter: 'drop-shadow(0 0 3px rgba(110,231,255,0.7))'
                              }}
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* SVG Draggable Nodes */}
                  <g>
                    {(nodes || []).map((node) => {
                      if (!node) return null;
                      const isSelected = selectedNode?.id === node.id;
                      const opacity = getNodeOpacity(node);

                      // Node base radius mapped to intensity score
                      const nodeRadius = Math.max(8, (node?.score || 50) / 7);
                      const glowRadius = nodeRadius + 12;

                      return (
                        <g
                          key={node.id}
                          onPointerDown={(e) => handlePointerDown(node.id, e)}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectNode(node);
                          }}
                          className="cursor-pointer group hover:opacity-100"
                          style={{ opacity, transition: 'opacity 0.4s ease' }}
                        >
                          {/* Cyan Active Ambient Glow (for node score > 80 or selected) */}
                          {(node.score > 80 || isSelected) && (
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={nodeRadius + 4}
                              fill="#6EE7FF"
                              opacity={isSelected ? 0.35 : 0.15}
                              className="animate-pulse"
                              style={{
                                filter: 'blur(6px)'
                              }}
                            />
                          )}

                          {/* Concentric glow ring on hover/select */}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={glowRadius}
                            fill="none"
                            stroke={isSelected ? '#6EE7FF' : 'rgba(255,255,255,0.03)'}
                            strokeWidth={isSelected ? 1.5 : 1}
                            strokeDasharray={isSelected ? '4, 4' : 'none'}
                            className="transition-all duration-500 origin-center animate-spin"
                            style={{
                              animationDuration: '20s',
                              opacity: isSelected ? 0.4 : 0.05
                            }}
                          />

                          {/* Solid core circle */}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={nodeRadius}
                            fill={isSelected ? '#6EE7FF' : '#050505'}
                            stroke={isSelected ? '#6EE7FF' : 'rgba(255,255,255,0.7)'}
                            strokeWidth={1.5}
                            className="transition-all duration-300 origin-center group-hover:scale-110"
                          />

                          {/* Text Label */}
                          <text
                            x={node.x}
                            y={node.y + nodeRadius + 15}
                            fill={isSelected ? '#6EE7FF' : 'rgba(255,255,255,0.7)'}
                            fontSize={10}
                            fontWeight={isSelected ? 500 : 300}
                            textAnchor="middle"
                            className="select-none transition-colors duration-300 tracking-wider uppercase font-sans pointer-events-none"
                          >
                            {getNodeLabelLines(node.id).map((line, lineIdx) => (
                              <tspan key={`${node.id}-${lineIdx}`} x={node.x} dy={lineIdx === 0 ? 0 : 12}>
                                {line}
                              </tspan>
                            ))}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </g>
              </svg>
            </div>
          </div>

          {/* Node inspect Sidebar (Right - 1 column) */}
          <div className="lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-8 z-20">
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div
                  key={selectedNode.id}
                  initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -15, filter: 'blur(4px)' }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="premium-glass p-6 rounded-2xl flex flex-col gap-5 shadow-[0_24px_50px_rgba(0,0,0,0.9)]"
                >
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-[#71717A] font-semibold">
                      {selectedNode.category || 'Cognitive'} Style
                    </span>
                    <h3 className="text-xl font-light tracking-wide text-white mt-1.5 font-serif break-words">
                      {selectedNode.id}
                    </h3>
                    <p className="text-xs text-[#A1A1AA] font-light mt-3 leading-relaxed break-words">
                      {getPatternDesc(selectedNode.id)}
                    </p>
                  </div>

                  <div className="flex justify-between border-t border-white/[0.04] pt-4 text-xs font-light">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[#71717A] text-[9px] uppercase tracking-wider font-semibold">Index Score</span>
                      <span className="text-[#6EE7FF] font-medium text-xl font-serif">{selectedNode.score || 0}%</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[#71717A] text-[9px] uppercase tracking-wider font-semibold">Confidence</span>
                      <span className="text-white font-medium text-xl font-serif">{selectedNode.confidence || 0}%</span>
                    </div>
                  </div>

                  {/* Expand Narrative story button */}
                  {selectedPatternDetails && (
                    <button
                      onClick={() => setIsDrawerOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-white text-black font-semibold uppercase tracking-wider text-[10px] hover:bg-neutral-200 transition-all duration-300 mt-2 flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(255,255,255,0.15)]"
                    >
                      <Sparkles size={11} /> Open Narrative Dossier
                    </button>
                  )}

                  {/* Relationship connections list */}
                  <div className="border-t border-white/[0.04] pt-4 flex flex-col gap-3">
                    <h4 className="text-[9px] uppercase tracking-[0.2em] text-[#71717A] flex items-center gap-1.5 font-semibold select-none">
                      <Compass size={12} className="text-[#6EE7FF]" /> Active Traces
                    </h4>

                    <div className="flex flex-col gap-2.5">
                      {(highlightedConnections?.incoming || []).map((inc, i) => (
                        <div key={`inc-${i}`} className="flex items-center gap-2 text-[11px] leading-none text-neutral-400 bg-white/[0.01] border border-white/5 p-2 rounded-lg min-w-0">
                          <span className="text-[#A1A1AA] font-medium truncate flex-1 min-w-0">{inc}</span>
                          <ArrowRight size={10} className="text-[#6EE7FF] shrink-0" />
                          <span className="text-white bg-white/5 px-2 py-0.5 rounded text-[10px] tracking-wide border border-white/10 uppercase shrink-0">{selectedNode.id}</span>
                        </div>
                      ))}

                      {(highlightedConnections?.outgoing || []).map((out, i) => (
                        <div key={`out-${i}`} className="flex items-center gap-2 text-[11px] leading-none text-neutral-400 bg-white/[0.01] border border-white/5 p-2 rounded-lg min-w-0">
                          <span className="text-white bg-white/5 px-2 py-0.5 rounded text-[10px] tracking-wide border border-white/10 uppercase shrink-0">{selectedNode.id}</span>
                          <ArrowRight size={10} className="text-[#6EE7FF] shrink-0" />
                          <span className="text-[#A1A1AA] font-medium truncate flex-1 min-w-0">{out}</span>
                        </div>
                      ))}

                      {(highlightedConnections?.incoming || []).length === 0 && (highlightedConnections?.outgoing || []).length === 0 && (
                        <span className="text-xs text-neutral-500 font-light leading-relaxed">This pattern remains isolated. Dialogue repetitions will forge connections.</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="premium-glass p-8 rounded-2xl text-center text-[#71717A] py-16 flex flex-col gap-4 items-center justify-center">
                  <HelpCircle size={28} className="stroke-[1.5] text-[#71717A] animate-pulse" />
                  <div className="text-xs leading-relaxed font-light">
                    Select a neural style node on the canvas to inspect its behavioral mapping and trace bridges.
                  </div>
                </div>
              )}
            </AnimatePresence>

            <div className="premium-glass p-5 rounded-2xl flex gap-3 text-neutral-400">
              <Info className="text-[#71717A] shrink-0" size={16} />
              <div className="flex flex-col gap-1.5 text-[11px] leading-relaxed font-light text-[#A1A1AA] break-words">
                <span className="font-semibold text-white flex items-center gap-1 select-none">
                  <Sparkles size={11} className="text-[#6EE7FF]" /> Elastic Physics
                </span>
                Drag nodes to reposition them, or scroll/drag background to pan and zoom. Click a node to view its traces.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sliding Drawer for Dossier Overlay */}
      <AnimatePresence>
        {isDrawerOpen && selectedPatternDetails && (
          <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
            />
            
            {/* Drawer Body */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="relative w-full max-w-md h-full bg-[#0F1115]/95 border-l border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.95)] p-6 md:p-8 flex flex-col gap-6 pointer-events-auto overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-[#71717A] font-semibold">Narrative Dossier</span>
                  <h3 className="text-xl font-light text-white mt-1 font-serif">{selectedNode.id}</h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 text-neutral-400 hover:text-white uppercase text-[10px] tracking-widest font-semibold border border-white/5 rounded-full hover:bg-white/5 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="flex flex-col gap-5">
                
                {/* Narrative Dossier Questions */}
                {(() => {
                  const dData = DOSSIER_MAPPING[selectedNode.id] || DOSSIER_MAPPING.default;
                  const questions = [
                    { q: 'Why does this exist?', a: dData.why },
                    { q: 'What feeds it?', a: dData.feeds },
                    { q: 'What does it create?', a: dData.creates },
                    { q: 'What strengthens it?', a: dData.strengthens },
                    { q: 'What weakens it?', a: dData.weakens },
                    { q: 'How has it changed?', a: dData.change }
                  ];

                  return (
                    <div className="flex flex-col gap-4">
                      {questions.map((item, idx) => (
                        <div key={idx} className="border-b border-white/[0.03] pb-3 flex flex-col gap-1">
                          <span className="text-[8px] uppercase tracking-widest text-[#6EE7FF] font-semibold select-none">
                            {item.q}
                          </span>
                          <p className="text-xs text-[#A1A1AA] font-light leading-relaxed">
                            {item.a}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
