/* @ds-bundle: {"format":4,"namespace":"FootlinkDesignSystem_5f1c43","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"CountBadge","sourcePath":"components/core/Badge.jsx"},{"name":"NotificationDot","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Tooltip","sourcePath":"components/core/Tooltip.jsx"},{"name":"Flag","sourcePath":"components/data/Flag.jsx"},{"name":"NationalitiesRow","sourcePath":"components/data/Flag.jsx"},{"name":"CountryRow","sourcePath":"components/data/Flag.jsx"},{"name":"StatusPill","sourcePath":"components/data/StatusPill.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"AthleteCell","sourcePath":"components/data/Table.jsx"},{"name":"ClubCell","sourcePath":"components/data/Table.jsx"},{"name":"AthleteCard","sourcePath":"components/domain/AthleteCard.jsx"},{"name":"KanbanColumn","sourcePath":"components/domain/KanbanColumn.jsx"},{"name":"AddColumnButton","sourcePath":"components/domain/KanbanColumn.jsx"},{"name":"MonitoringButton","sourcePath":"components/domain/MonitoringButton.jsx"},{"name":"ChatMessage","sourcePath":"components/feedback/ChatMessage.jsx"},{"name":"DatePill","sourcePath":"components/feedback/ChatMessage.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SegmentedToggle","sourcePath":"components/forms/SegmentedToggle.jsx"},{"name":"GenderSwitcher","sourcePath":"components/forms/SegmentedToggle.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"AppBar","sourcePath":"components/navigation/AppBar.jsx"},{"name":"NavDrawer","sourcePath":"components/navigation/NavDrawer.jsx"},{"name":"Pagination","sourcePath":"components/navigation/Pagination.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"TabButtons","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"557694fa644d","components/core/Badge.jsx":"1d38cd28fbdb","components/core/Button.jsx":"0cc956d59dc4","components/core/Card.jsx":"af45d6106c67","components/core/Tooltip.jsx":"d772d581a49a","components/data/Flag.jsx":"a511435e17de","components/data/StatusPill.jsx":"bf32b40b9595","components/data/Table.jsx":"a2cdb9b25abf","components/domain/AthleteCard.jsx":"1034b5d72407","components/domain/KanbanColumn.jsx":"798fd6fc91a9","components/domain/MonitoringButton.jsx":"b349d1d5762c","components/feedback/ChatMessage.jsx":"0478bc16cf96","components/feedback/Dialog.jsx":"bb4936bfb5ea","components/feedback/EmptyState.jsx":"281f925ed037","components/forms/Input.jsx":"b29fc2bc93dc","components/forms/SegmentedToggle.jsx":"cf103f85443a","components/forms/Select.jsx":"206c90980528","components/navigation/AppBar.jsx":"a25d8e0591a1","components/navigation/NavDrawer.jsx":"44c93bd9bf38","components/navigation/Pagination.jsx":"35491c71f906","components/navigation/Tabs.jsx":"83dd99b1f6de","ui_kits/footlink-scout/AppShell.jsx":"cbfe54052a33","ui_kits/footlink-scout/AthleteDetailScreen.jsx":"38bdcc648ce3","ui_kits/footlink-scout/AthletesScreen.jsx":"af154d851099","ui_kits/footlink-scout/CompetitionsScreen.jsx":"934f5d3ca508","ui_kits/footlink-scout/MessagesScreen.jsx":"1085ca627e32","ui_kits/footlink-scout/WorkflowScreen.jsx":"ccda553c2d88","ui_kits/footlink-scout/data.js":"680a398c0ec0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FootlinkDesignSystem_5f1c43 = window.FootlinkDesignSystem_5f1c43 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function initials(name) {
  if (!name) return '';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function Avatar({
  src,
  name,
  size = 44,
  shield,
  ring,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      background: 'var(--lightPurple4)',
      color: 'var(--lightPurple1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(size * 0.36),
      fontWeight: 700,
      border: ring ? '2px solid ' + ring : 'none',
      transition: 'all 300ms linear'
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name || '',
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials(name)), shield ? /*#__PURE__*/React.createElement("img", {
    src: shield,
    alt: "",
    style: {
      position: 'absolute',
      bottom: -2,
      right: -4,
      width: Math.max(14, Math.round(size * 0.41)),
      height: Math.max(14, Math.round(size * 0.41)),
      borderRadius: 3,
      border: '1px solid var(--gray5)',
      background: 'var(--white)',
      objectFit: 'contain'
    }
  }) : null);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const TONES = {
  brazil: {
    background: '#e8f5e9',
    color: '#2e7d32'
  },
  latam: {
    background: '#e3f2fd',
    color: '#1565c0'
  },
  global: {
    background: '#f3e5f5',
    color: '#6a1b9a'
  },
  fifa: {
    background: '#fff8e1',
    color: '#e65100'
  },
  purple: {
    background: 'var(--lightPurple4)',
    color: 'var(--lightPurple1)'
  },
  active: {
    background: 'var(--green5)',
    color: 'var(--green1)'
  },
  inactive: {
    background: 'var(--dangerBg)',
    color: 'var(--red)'
  },
  pending: {
    background: 'var(--orange3)',
    color: '#ce9232'
  },
  info: {
    background: 'rgba(41,182,246,.15)',
    color: 'var(--info)'
  }
};
function Badge({
  tone = 'purple',
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      ...(TONES[tone] || TONES.purple),
      ...style
    }
  }, children);
}
function CountBadge({
  count,
  tone = 'purple',
  style
}) {
  const skin = tone === 'danger' ? {
    background: 'var(--danger)',
    color: '#fff'
  } : {
    background: 'var(--lightPurple1)',
    color: '#fff'
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      borderRadius: 9,
      fontSize: 9,
      fontWeight: 800,
      ...skin,
      ...style
    }
  }, count);
}
function NotificationDot({
  color = 'var(--danger)',
  size = 10,
  ring = 'var(--white)',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      border: '2px solid ' + ring,
      boxSizing: 'content-box',
      ...style
    }
  });
}
Object.assign(__ds_scope, { Badge, CountBadge, NotificationDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const COLORS = {
  green: {
    background: 'var(--lightPurple1)',
    color: '#ffffff',
    border: '1px solid var(--lightPurple1)'
  },
  purple: {
    background: 'var(--lightPurple1)',
    color: 'var(--spanishWhite)',
    border: '1px solid var(--lightPurple1)'
  },
  danger: {
    background: '#eb5757',
    color: 'var(--spanishWhite)',
    border: '1px solid #eb5757'
  },
  orange: {
    background: 'var(--orange)',
    color: 'var(--spanishWhite)',
    border: '1px solid var(--orange)'
  },
  white: {
    background: 'var(--white)',
    color: 'var(--lightPurple1)',
    border: '1px solid var(--gray5)'
  },
  secondary: {
    background: 'var(--white)',
    color: 'var(--lightPurple1)',
    border: '1px solid var(--lightPurple1)'
  },
  transparent: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid var(--gray5)'
  },
  link: {
    background: 'transparent',
    color: 'var(--lightPurple1)',
    border: 'none'
  },
  default: {
    background: 'var(--light)',
    color: 'var(--darkPurple1)',
    border: '1px solid var(--gray5)'
  }
};
function Button({
  color = 'default',
  rounded = false,
  fluid = false,
  outline = false,
  smaller = false,
  noShadow = false,
  disabled = false,
  iconLeft,
  iconRight,
  children,
  style,
  onClick,
  type = 'button',
  title
}) {
  const [hover, setHover] = React.useState(false);
  const base = COLORS[color] || COLORS.default;
  const skin = disabled ? {
    background: 'var(--white)',
    color: 'var(--gray3)',
    border: '1.5px solid var(--gray5)'
  } : outline ? {
    background: 'transparent',
    color: base.background === 'transparent' ? base.color : base.background,
    border: '1px solid ' + (base.background === 'transparent' ? base.color : base.background)
  } : base;
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    title: title,
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: fluid ? 'flex' : 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: fluid ? '100%' : 'auto',
      padding: smaller ? '7px 22px' : '10px 20px',
      borderRadius: rounded ? 12 : 8,
      fontFamily: 'inherit',
      fontSize: smaller ? 13 : 14,
      fontWeight: 600,
      lineHeight: '14px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: !noShadow && hover && !disabled ? '0 4px 12px rgba(0,0,0,.05)' : 'none',
      textDecoration: color === 'link' && hover ? 'underline' : 'none',
      ...skin,
      ...style
    }
  }, iconLeft ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: 18,
      height: 18
    }
  }, iconLeft) : null, children, iconRight ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: 18,
      height: 18
    }
  }, iconRight) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  variant = 'default',
  padding,
  title,
  footer,
  children,
  style,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  const variants = {
    default: {
      borderRadius: 12,
      border: '1px solid var(--gray5)',
      boxShadow: '0 2px 8px rgba(0,0,0,.02)'
    },
    softShadow: {
      borderRadius: 12,
      border: '1px solid var(--gray5)',
      boxShadow: '1px 1px 3px rgba(0,0,0,.25)'
    },
    borderedGrey: {
      borderRadius: 12,
      borderRight: '1px solid var(--gray5)',
      borderBottom: '1px solid var(--gray5)',
      boxShadow: 'none'
    },
    profile: {
      borderRadius: 15,
      border: '1px solid var(--gray5)',
      boxShadow: '0 4px 15px rgba(0,0,0,.05)',
      overflow: 'hidden'
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--white)',
      padding: padding != null ? padding : 24,
      transition: 'box-shadow 300ms, background-color 300ms, border-color 300ms',
      ...variants[variant],
      boxShadow: hover ? '0 4px 12px rgba(0,0,0,.05)' : variants[variant].boxShadow,
      ...style
    }
  }, title ? /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 20,
      fontWeight: 600,
      color: 'var(--darkPurple1)',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, title) : null, children, footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      paddingTop: 15,
      borderTop: '1px solid var(--gray5)',
      textAlign: 'center'
    }
  }, footer) : null);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Tooltip.jsx
try { (() => {
const OFFSETS = {
  bottom: {
    top: 'calc(100% + 10px)',
    left: '50%',
    hidden: 'translateX(-50%) translateY(-4px)',
    shown: 'translateX(-50%) translateY(0)'
  },
  top: {
    bottom: 'calc(100% + 10px)',
    left: '50%',
    hidden: 'translateX(-50%) translateY(4px)',
    shown: 'translateX(-50%) translateY(0)'
  },
  left: {
    right: 'calc(100% + 10px)',
    top: '50%',
    hidden: 'translateY(-50%) translateX(4px)',
    shown: 'translateY(-50%) translateX(0)'
  },
  right: {
    left: 'calc(100% + 10px)',
    top: '50%',
    hidden: 'translateY(-50%) translateX(-4px)',
    shown: 'translateY(-50%) translateX(0)'
  }
};
function Tooltip({
  label,
  position = 'bottom',
  children,
  style
}) {
  const [open, setOpen] = React.useState(false);
  const o = OFFSETS[position] || OFFSETS.bottom;
  const {
    hidden,
    shown,
    ...pos
  } = o;
  return /*#__PURE__*/React.createElement("span", {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    style: {
      position: 'relative',
      display: 'inline-flex',
      ...style
    }
  }, children, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      ...pos,
      background: 'var(--darkPurple1)',
      color: '#fff',
      fontSize: 12,
      fontWeight: 500,
      padding: '6px 12px',
      borderRadius: 6,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      boxShadow: '0 4px 16px rgba(0,0,0,.25)',
      zIndex: 1100,
      opacity: open ? 1 : 0,
      transform: open ? shown : hidden,
      transition: 'opacity .18s ease, transform .18s ease'
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/data/Flag.jsx
try { (() => {
const SIZES = {
  xs: [18, 12],
  sm: [20, 14],
  md: [18, 'auto'],
  lg: [25, 'auto'],
  topbar: [30, 'auto'],
  xl: [64, 64]
};
const CDN = 'https://storage.googleapis.com/rdf_static/flags/4x3/';
function Flag({
  code,
  src,
  name,
  size = 'sm',
  style
}) {
  const [w, h] = SIZES[size] || SIZES.sm;
  return /*#__PURE__*/React.createElement("img", {
    src: src || (code ? CDN + String(code).toLowerCase() + '.svg' : undefined),
    alt: name || code || '',
    title: name,
    style: {
      width: w,
      height: h === 'auto' ? 'auto' : h,
      objectFit: 'cover',
      borderRadius: size === 'xl' ? 4 : 2,
      boxShadow: '0 1px 3px rgba(0,0,0,.18)',
      flexShrink: 0,
      ...style
    }
  });
}

/** Up to three flags in a row, then a +N overflow badge. */
function NationalitiesRow({
  nationalities = [],
  max = 3,
  size = 'sm',
  style
}) {
  const shown = nationalities.slice(0, max);
  const extra = nationalities.length - shown.length;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      ...style
    }
  }, shown.map((n, i) => /*#__PURE__*/React.createElement(Flag, {
    key: i,
    code: n.code,
    src: n.flag,
    name: n.name,
    size: size
  })), extra > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--lightPurple1)',
      background: 'var(--lightPurple4)',
      borderRadius: 20,
      padding: '2px 6px'
    }
  }, "+", extra) : null);
}

/** Flag + country name inline. */
function CountryRow({
  code,
  src,
  name,
  size = 'md',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      color: 'var(--gray2)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(Flag, {
    code: code,
    src: src,
    name: name,
    size: size
  }), /*#__PURE__*/React.createElement("span", null, name));
}
Object.assign(__ds_scope, { Flag, NationalitiesRow, CountryRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Flag.jsx", error: String((e && e.message) || e) }); }

// components/data/StatusPill.jsx
try { (() => {
const TONES = {
  in_progress: {
    background: '#e1f5fe',
    color: '#0288d1'
  },
  completed: {
    background: '#e8f5e9',
    color: '#2e7d32'
  },
  not_started: {
    background: 'var(--light)',
    color: 'var(--gray)'
  },
  active: {
    background: 'var(--green5)',
    color: 'var(--green1)'
  },
  inactive: {
    background: 'var(--dangerBg)',
    color: 'var(--red)'
  },
  pending: {
    background: 'var(--orange3)',
    color: '#ce9232'
  }
};
function StatusPill({
  status = 'in_progress',
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      ...(TONES[status] || TONES.in_progress),
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
/**
 * Institutional table. `columns` describe headers; `rows` are arrays or objects of cell nodes.
 * Density `institutional` = the 20px/15px list table; `compact` = the 10px/6px stat table
 * used inside cards on the athlete detail page.
 */
function Table({
  columns = [],
  rows = [],
  density = 'institutional',
  stickyHeader,
  sort,
  onSortChange,
  emptyState,
  style
}) {
  const [hover, setHover] = React.useState(null);
  const cols = columns.map(c => typeof c === 'string' ? {
    key: c,
    label: c
  } : c);
  const compact = density === 'compact';
  const thBase = compact ? {
    padding: '10px 6px',
    fontSize: 10,
    background: 'var(--light)',
    borderBottom: '1px solid var(--gray5)'
  } : {
    padding: '20px 15px',
    fontSize: 11,
    background: 'var(--white)',
    borderBottom: '2px solid var(--gray5)'
  };
  const tdBase = compact ? {
    padding: '10px 6px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--darkPurple1)'
  } : {
    padding: '10px 15px',
    fontSize: 14,
    fontWeight: 400,
    color: 'var(--gray2)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: compact ? 'transparent' : 'var(--white)',
      borderRadius: compact ? 0 : 12,
      border: compact ? 'none' : '1px solid var(--gray5)',
      boxShadow: compact ? 'none' : '0 4px 15px rgba(0,0,0,.03)',
      overflow: compact ? 'auto' : 'clip',
      marginBottom: compact ? 0 : 20,
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, cols.map(c => {
    const dir = sort && sort.key === c.key ? sort.dir : 'none';
    const sortable = c.sortable !== false && !compact;
    return /*#__PURE__*/React.createElement("th", {
      key: c.key,
      onClick: sortable && onSortChange ? () => onSortChange({
        key: c.key,
        dir: dir === 'asc' ? 'desc' : 'asc'
      }) : undefined,
      style: {
        ...thBase,
        fontWeight: 700,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        textAlign: c.align || 'left',
        width: c.width,
        color: dir === 'none' ? 'var(--gray3)' : 'var(--lightPurple1)',
        cursor: sortable ? 'pointer' : 'default',
        position: stickyHeader ? 'sticky' : 'static',
        top: stickyHeader ? 'var(--sticky-header-offset, 60px)' : undefined,
        zIndex: stickyHeader ? 100 : undefined
      }
    }, c.label, dir === 'asc' ? ' ↑' : dir === 'desc' ? ' ↓' : '');
  }))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: cols.length,
    style: {
      padding: 0
    }
  }, emptyState)) : rows.map((r, ri) => {
    const cells = Array.isArray(r) ? r : cols.map(c => r[c.key]);
    const dim = !Array.isArray(r) && r.__inactive;
    return /*#__PURE__*/React.createElement("tr", {
      key: ri,
      onMouseEnter: () => setHover(ri),
      onMouseLeave: () => setHover(null),
      style: {
        background: hover === ri ? 'var(--surface-hover)' : 'transparent',
        opacity: dim ? 0.5 : 1,
        filter: dim ? 'grayscale(1)' : 'none'
      }
    }, cells.map((cell, ci) => /*#__PURE__*/React.createElement("td", {
      key: ci,
      style: {
        ...tdBase,
        verticalAlign: 'middle',
        textAlign: cols[ci] && cols[ci].align || 'left',
        borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--gray5)'
      }
    }, cell)));
  }))));
}

/** The two-line athlete cell used in list tables: purple nickname over grey full name. */
function AthleteCell({
  nickname,
  fullName,
  avatar
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      overflow: 'hidden',
      background: 'var(--lightPurple4)',
      color: 'var(--lightPurple1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 700,
      flexShrink: 0
    }
  }, avatar ? /*#__PURE__*/React.createElement("img", {
    src: avatar,
    alt: "",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : (nickname || '').slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--lightPurple1)',
      textDecoration: 'none'
    }
  }, nickname), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--gray3)'
    }
  }, fullName)));
}

/** Club crest + linked name. Crests never get a border radius. */
function ClubCell({
  name,
  crest,
  size = 24
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, crest ? /*#__PURE__*/React.createElement("img", {
    src: crest,
    alt: "",
    style: {
      width: size,
      height: size,
      objectFit: 'contain'
    }
  }) : null, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: 'var(--lightPurple1)',
      textDecoration: 'none',
      fontWeight: 600
    }
  }, name));
}
Object.assign(__ds_scope, { Table, AthleteCell, ClubCell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/domain/AthleteCard.jsx
try { (() => {
const VARIANTS = {
  gray: {
    background: 'var(--kanban-card-bg)',
    border: 'var(--kanban-card-border)',
    dot: null
  },
  yellow: {
    background: 'var(--card-yellow-bg)',
    border: 'var(--card-yellow-border)',
    dot: '#f2c94c'
  },
  green: {
    background: 'var(--card-green-bg)',
    border: 'var(--card-green-border)',
    dot: '#6fcf97'
  },
  blue: {
    background: 'var(--card-blue-bg)',
    border: 'var(--card-blue-border)',
    dot: '#2d9cdb'
  },
  red: {
    background: 'var(--card-red-bg)',
    border: 'var(--card-red-border)',
    dot: '#eb5757'
  }
};
function AthleteCard({
  nickname,
  fullName,
  avatar,
  shield,
  nationality,
  meta,
  rating,
  variant = 'gray',
  action,
  showColorDot,
  onDelete,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const v = VARIANTS[variant] || VARIANTS.gray;
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: v.background,
      border: '1px solid ' + v.border,
      padding: '8px 10px 8px 8px',
      borderRadius: 10,
      boxShadow: hover ? '0 4px 12px rgba(0,0,0,.08)' : '0 1px 4px rgba(0,0,0,.05)',
      transition: 'box-shadow .2s',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 44,
      height: 44,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      overflow: 'hidden',
      background: 'var(--lightPurple4)',
      color: 'var(--lightPurple1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 15,
      fontWeight: 700
    }
  }, avatar ? /*#__PURE__*/React.createElement("img", {
    src: avatar,
    alt: "",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : (nickname || '').slice(0, 2).toUpperCase()), shield ? /*#__PURE__*/React.createElement("img", {
    src: shield,
    alt: "",
    style: {
      position: 'absolute',
      bottom: -2,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: 3,
      border: '1px solid var(--gray5)',
      background: '#fff',
      objectFit: 'contain'
    }
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--kanban-name)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, nickname), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--dark)',
      opacity: 0.75,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, fullName), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--gray3)'
    }
  }, nationality ? /*#__PURE__*/React.createElement(__ds_scope.Flag, {
    code: nationality,
    size: "sm",
    style: {
      width: 16,
      height: 12
    }
  }) : null, meta), rating != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#f2994a',
      fontSize: 12,
      letterSpacing: 1
    }
  }, '★★★★★'.slice(0, rating), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gray5)'
    }
  }, '★★★★★'.slice(rating))) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0
    }
  }, showColorDot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 15,
      height: 15,
      borderRadius: '50%',
      background: v.dot || 'var(--gray5)',
      cursor: 'pointer'
    }
  }) : null, action, onDelete ? /*#__PURE__*/React.createElement("span", {
    onClick: onDelete,
    style: {
      width: 16,
      height: 16,
      color: 'var(--gray3)',
      cursor: 'pointer',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "3 6 5 6 21 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 6l-1 14H6L5 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 11v6M14 11v6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 6V4h6v2"
  }))) : null));
}
Object.assign(__ds_scope, { AthleteCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/AthleteCard.jsx", error: String((e && e.message) || e) }); }

// components/domain/KanbanColumn.jsx
try { (() => {
function KanbanColumn({
  title,
  count,
  children,
  onAddAthlete,
  onMenu,
  style
}) {
  const [hoverAdd, setHoverAdd] = React.useState(false);
  const [hoverMenu, setHoverMenu] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: 320,
      flexShrink: 0,
      background: 'var(--white)',
      border: '1px solid var(--gray5)',
      borderRadius: 12,
      maxHeight: 'calc(100% - 8px)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 8px 12px 16px',
      borderBottom: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: 'var(--darkPurple1)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, title), count != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 20,
      background: 'var(--lightPurple4)',
      color: 'var(--lightPurple1)'
    }
  }, count) : null), /*#__PURE__*/React.createElement("span", {
    onClick: onMenu,
    onMouseEnter: () => setHoverMenu(true),
    onMouseLeave: () => setHoverMenu(false),
    style: {
      width: 30,
      height: 30,
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: 'var(--gray3)',
      background: hoverMenu ? 'var(--surface-hover)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "3",
    r: "1.2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "1.2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "13",
    r: "1.2"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 10px 4px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, children, onAddAthlete ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAddAthlete,
    onMouseEnter: () => setHoverAdd(true),
    onMouseLeave: () => setHoverAdd(false),
    style: {
      height: 36,
      marginBottom: 6,
      border: '1.5px solid var(--lightPurple1)',
      borderRadius: 8,
      background: hoverAdd ? 'var(--lightPurple4)' : 'transparent',
      color: 'var(--lightPurple1)',
      fontFamily: 'inherit',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'background .2s'
    }
  }, "+ Adicionar atleta") : null));
}
function AddColumnButton({
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: 240,
      minHeight: 120,
      flexShrink: 0,
      cursor: 'pointer',
      border: '2px dashed ' + (hover ? 'var(--lightPurple1)' : 'var(--gray5)'),
      borderRadius: 12,
      background: hover ? 'var(--lightPurple4)' : 'transparent',
      color: hover ? 'var(--lightPurple1)' : 'var(--gray3)',
      fontFamily: 'inherit',
      fontSize: 14,
      fontWeight: 600,
      transition: 'all .2s',
      ...style
    }
  }, "+ Nova coluna");
}
Object.assign(__ds_scope, { KanbanColumn, AddColumnButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/KanbanColumn.jsx", error: String((e && e.message) || e) }); }

// components/domain/MonitoringButton.jsx
try { (() => {
const SIZES = {
  sm: {
    h: 34,
    w: 140,
    font: 12,
    status: 110,
    icon: 14,
    side: 30
  },
  md: {
    h: 40,
    w: 160,
    font: 13,
    status: 120,
    icon: 17,
    side: 40
  },
  lg: {
    h: 48,
    w: 175,
    font: 14,
    status: 130,
    icon: 20,
    side: 45
  }
};
const EyeIcon = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 576 512",
  width: "1em",
  height: "1em",
  fill: "currentColor",
  style: {
    width: '1em',
    height: '1em'
  }
}, /*#__PURE__*/React.createElement("path", {
  d: "M288 32C144.5 32 22.9 125.4 0 256c22.9 130.6 144.5 224 288 224s265.1-93.4 288-224C553.1 125.4 431.5 32 288 32zm0 368c-79.5 0-144-64.5-144-144s64.5-144 144-144 144 64.5 144 144-64.5 144-144 144zm0-224a80 80 0 1 0 0 160 80 80 0 1 0 0-160z"
}));
const CheckIcon = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 512 512",
  fill: "currentColor"
}, /*#__PURE__*/React.createElement("path", {
  d: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"
}));
const ListIcon = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 512 512",
  fill: "currentColor"
}, /*#__PURE__*/React.createElement("path", {
  d: "M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm48-208a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z"
}));
function MonitoringButton({
  monitoring = false,
  size = 'lg',
  loading = false,
  onToggle,
  onOpenLists,
  style
}) {
  const s = SIZES[size] || SIZES.lg;
  const [hoverA, setHoverA] = React.useState(false);
  const [hoverB, setHoverB] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'stretch',
      overflow: 'hidden',
      height: s.h,
      width: s.w,
      borderRadius: 8,
      color: '#fff',
      flexShrink: 0,
      background: monitoring ? 'var(--orange2)' : 'var(--lightPurple1)',
      opacity: loading ? 0.6 : 1,
      pointerEvents: loading ? 'none' : 'auto',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onToggle,
    onMouseEnter: () => setHoverA(true),
    onMouseLeave: () => setHoverA(false),
    style: {
      width: s.status,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 16,
      borderRight: '1px solid rgba(255,255,255,.2)',
      cursor: 'pointer',
      fontSize: s.font,
      fontWeight: 600,
      background: hoverA ? 'rgba(0,0,0,.1)' : 'transparent',
      transition: 'background .2s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: s.icon,
      height: s.icon,
      flexShrink: 0
    }
  }, monitoring ? /*#__PURE__*/React.createElement(CheckIcon, null) : /*#__PURE__*/React.createElement(EyeIcon, null)), /*#__PURE__*/React.createElement("span", null, monitoring ? 'Monitorando' : 'Monitorar')), /*#__PURE__*/React.createElement("div", {
    onClick: e => {
      e.stopPropagation();
      onOpenLists && onOpenLists();
    },
    onMouseEnter: () => setHoverB(true),
    onMouseLeave: () => setHoverB(false),
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      background: hoverB ? 'rgba(0,0,0,.1)' : 'transparent',
      transition: 'background .2s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: s.icon - 3,
      height: s.icon - 3
    }
  }, /*#__PURE__*/React.createElement(ListIcon, null))));
}
Object.assign(__ds_scope, { MonitoringButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/MonitoringButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ChatMessage.jsx
try { (() => {
function ChatMessage({
  type = 'received',
  sender,
  text,
  time,
  avatar,
  shield,
  children,
  style
}) {
  const sent = type === 'sent';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: sent ? 'flex-end' : 'flex-start',
      gap: 8,
      marginBottom: 12,
      ...style
    }
  }, !sent && avatar ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 36,
      height: 36,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: avatar,
    alt: "",
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      objectFit: 'cover'
    }
  }), shield ? /*#__PURE__*/React.createElement("img", {
    src: shield,
    alt: "",
    style: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 14,
      height: 14,
      borderRadius: 3,
      border: '1.5px solid var(--white)',
      background: '#fff',
      objectFit: 'contain'
    }
  }) : null) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 480,
      padding: '10px 14px 8px',
      fontSize: 14,
      fontWeight: 500,
      background: sent ? 'var(--bubble-sent-bg)' : 'var(--bubble-received-bg)',
      color: sent ? 'var(--bubble-sent-text)' : 'var(--bubble-received-text)',
      borderRadius: sent ? '12px 12px 0 12px' : '12px 12px 12px 0'
    }
  }, !sent && sender ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: 'var(--lightPurple1)',
      marginBottom: 3
    }
  }, sender) : null, text ? /*#__PURE__*/React.createElement("div", {
    style: {
      textWrap: 'pretty'
    }
  }, text) : null, children, time ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--gray)',
      textAlign: 'right',
      marginTop: 2
    }
  }, time) : null));
}
function DatePill({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      margin: '12px 0',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '5px 20px',
      borderRadius: 20,
      background: 'var(--lightPurple4)',
      color: 'var(--lightPurple1)',
      fontSize: 12,
      fontWeight: 600
    }
  }, children));
}
Object.assign(__ds_scope, { ChatMessage, DatePill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ChatMessage.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open = true,
  title,
  children,
  footer,
  onClose,
  tone = 'default',
  width = 520,
  style
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,.5)',
      zIndex: 10000
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      zIndex: 10001,
      width,
      maxWidth: 'calc(100% - 40px)',
      maxHeight: 'calc(100% - 40px)',
      borderRadius: 8,
      background: 'var(--light)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 15,
      borderBottom: '1px solid var(--lightBorder)',
      background: tone === 'destructive' ? 'var(--dangerBg)' : 'var(--white)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: '1rem',
      fontWeight: 600,
      color: 'var(--black)'
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    style: {
      width: 44,
      height: 44,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--gray3)',
      fontSize: 18,
      lineHeight: 1
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      background: 'var(--white)',
      overflow: 'auto',
      flex: 1
    }
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      borderTop: '1px solid var(--lightBorder)',
      background: 'var(--white)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10
    }
  }, footer)) : null));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  icon,
  title,
  description,
  action,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: '48px 24px',
      textAlign: 'center',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 72,
      borderRadius: '50%',
      background: 'var(--empty-state-bg)',
      color: 'var(--empty-state-icon)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: 32,
      height: 32
    }
  }, icon)), title ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--darkPurple1)'
    }
  }, title) : null, description ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--gray3)',
      maxWidth: 380
    }
  }, description) : null, action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  label,
  iconLeft,
  iconRight,
  hasError,
  helper,
  smaller,
  rounded,
  darkMode,
  disabled,
  style,
  wrapperStyle
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...wrapperStyle
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--gray)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex'
    }
  }, iconLeft ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 15,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 15,
      height: 15,
      color: 'var(--gray3)',
      display: 'flex'
    }
  }, iconLeft) : null, /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      fontFamily: 'inherit',
      padding: '0.575rem 0.75rem',
      paddingLeft: iconLeft ? 38 : undefined,
      paddingRight: iconRight ? 38 : undefined,
      borderRadius: 8,
      border: '1px solid ' + (hasError ? '#eb5757' : darkMode ? 'var(--darkPurple7)' : 'var(--gray5)'),
      background: hasError ? 'var(--dangerBg)' : darkMode ? 'var(--darkPurple1)' : rounded ? 'var(--white)' : 'var(--light)',
      color: darkMode ? '#fff' : 'var(--black)',
      fontSize: smaller ? 13 : '0.9rem',
      outline: 'none',
      boxShadow: focus ? hasError ? '0 0 0 3px rgba(235,87,87,.12)' : '0 0 0 3px rgba(90,0,255,.12)' : 'none',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'auto',
      transition: 'border-color 300ms, background-color 300ms, box-shadow 200ms',
      ...style
    }
  }), iconRight ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 15,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 15,
      height: 15,
      color: 'var(--gray3)',
      display: 'flex'
    }
  }, iconRight) : null), helper ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.05em',
      color: hasError ? 'var(--red)' : 'var(--gray3)'
    }
  }, helper) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedToggle.jsx
try { (() => {
function SegmentedToggle({
  options = [],
  value,
  onChange,
  style
}) {
  const [hover, setHover] = React.useState(null);
  const items = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  const active = value != null ? value : items[0] && items[0].value;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      ...style
    }
  }, items.map(o => {
    const on = o.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: o.value,
      type: "button",
      onClick: () => onChange && onChange(o.value),
      onMouseEnter: () => setHover(o.value),
      onMouseLeave: () => setHover(null),
      style: {
        height: 42,
        padding: '0 20px',
        borderRadius: 8,
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        border: on ? '1px solid transparent' : '1px solid var(--lightBorder)',
        background: on ? 'var(--segment-active-bg)' : hover === o.value ? 'var(--surface-hover)' : 'var(--white)',
        color: on ? 'var(--segment-active-text)' : 'var(--dark)',
        transition: 'all .2s'
      }
    }, o.label);
  }));
}
function GenderSwitcher({
  value = 'MASC',
  onChange,
  style
}) {
  const fem = value === 'FEM';
  return /*#__PURE__*/React.createElement("div", {
    onClick: () => onChange && onChange(fem ? 'MASC' : 'FEM'),
    style: {
      position: 'relative',
      display: 'flex',
      width: 90,
      height: 32,
      padding: 2,
      background: 'rgba(255,255,255,.1)',
      border: '1px solid rgba(255,255,255,.2)',
      borderRadius: 20,
      cursor: 'pointer',
      userSelect: 'none',
      flexShrink: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: 2,
      width: 'calc(50% - 2px)',
      height: 'calc(100% - 4px)',
      background: 'var(--white)',
      borderRadius: 18,
      zIndex: 1,
      transform: fem ? 'translateX(100%)' : 'none',
      transition: 'transform .3s cubic-bezier(0.4,0,0.2,1)'
    }
  }), ['MASC', 'FEM'].map(k => /*#__PURE__*/React.createElement("span", {
    key: k,
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      fontWeight: 700,
      zIndex: 2,
      transition: 'color .3s',
      color: k === 'FEM' === fem ? 'var(--gender-active-color)' : 'rgba(255,255,255,.8)'
    }
  }, k)));
}
Object.assign(__ds_scope, { SegmentedToggle, GenderSwitcher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedToggle.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  value,
  onChange,
  options = [],
  placeholder,
  label,
  disabled,
  style,
  wrapperStyle
}) {
  const [focus, setFocus] = React.useState(false);
  const caret = "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23828282' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...wrapperStyle
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--gray)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: 'none',
      fontFamily: 'inherit',
      fontSize: 14,
      padding: '10px 2.5rem 10px 12px',
      borderRadius: 8,
      border: '1px solid var(--lightBorder)',
      background: 'var(--light)',
      backgroundImage: caret,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 0.7rem center',
      backgroundSize: '1em',
      color: 'var(--darkPurple1)',
      outline: 'none',
      boxShadow: focus ? '0 0 0 3px rgba(90,0,255,.12)' : 'none',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'border-color 300ms, box-shadow 200ms',
      ...style
    }
  }, placeholder ? /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder) : null, options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/navigation/AppBar.jsx
try { (() => {
function IconBtn({
  children,
  onClick,
  title,
  dot
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    title: title,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      width: 40,
      height: 40,
      borderRadius: 8,
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#ffffff',
      background: hover ? 'rgba(255,255,255,.1)' : 'transparent',
      transition: 'background .2s'
    }
  }, children, dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--orange)',
      border: '2px solid var(--lightPurple1)'
    }
  }) : null);
}
function AppBar({
  logoSrc,
  onMenuClick,
  menuDot,
  searchPlaceholder = 'Busque atletas ou clubes...',
  searchValue,
  onSearchChange,
  searchSlot,
  left,
  center,
  actions,
  user,
  style
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 30,
      width: '100%',
      height: 60,
      padding: '0 30px',
      background: '#5a00ff',
      color: '#ffffff',
      zIndex: 1000,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(IconBtn, {
    onClick: onMenuClick,
    title: "M\xF3dulos",
    dot: menuDot
  }, /*#__PURE__*/React.createElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
  }))), logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "Footlink",
    style: {
      height: 26
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      letterSpacing: '-0.02em'
    }
  }, "Footlink"), left), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 15,
      flexGrow: 1,
      maxWidth: 850
    }
  }, center, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flexGrow: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 42,
      padding: '0 15px',
      width: '100%',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,.1)',
      background: focus ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.1)',
      boxShadow: focus ? '0 4px 12px rgba(0,0,0,.2)' : 'none',
      transition: 'all .2s'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "rgba(255,255,255,.7)",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
  })), /*#__PURE__*/React.createElement("input", {
    value: searchValue,
    onChange: onSearchChange,
    placeholder: searchPlaceholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      background: 'none',
      border: 'none',
      outline: 'none',
      width: '100%',
      fontFamily: 'inherit',
      fontSize: 14,
      color: '#ffffff'
    }
  })), searchSlot)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      flexShrink: 0
    }
  }, actions, user ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginLeft: 10,
      padding: '2px 2px 2px 10px',
      borderRadius: 40,
      cursor: 'pointer',
      background: 'rgba(255,255,255,.1)',
      border: '1px solid rgba(255,255,255,.1)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: user,
    alt: "",
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      objectFit: 'cover',
      border: '2px solid rgba(255,255,255,.5)'
    }
  })) : null));
}
AppBar.IconButton = IconBtn;
Object.assign(__ds_scope, { AppBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/AppBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavDrawer.jsx
try { (() => {
function NavDrawer({
  open,
  onClose,
  user,
  org,
  sections = [],
  style
}) {
  const [hover, setHover] = React.useState(null);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,.5)',
      backdropFilter: 'blur(4px)',
      zIndex: 10500,
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
      transition: 'opacity .3s'
    }
  }), /*#__PURE__*/React.createElement("aside", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 320,
      height: '100%',
      background: 'var(--white)',
      borderRight: '1px solid var(--gray5)',
      boxShadow: '4px 0 24px rgba(0,0,0,.05)',
      zIndex: 11000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transform: open ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
      ...style
    }
  }, user ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 30px 20px',
      borderBottom: '1px solid var(--gray5)'
    }
  }, user.avatar ? /*#__PURE__*/React.createElement("img", {
    src: user.avatar,
    alt: "",
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      objectFit: 'cover',
      border: '2px solid #eee5ff',
      marginBottom: 10,
      display: 'block'
    }
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 20,
      fontWeight: 700,
      color: 'var(--darkPurple1)'
    }
  }, user.name), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--menu-link-color)',
      textDecoration: 'none'
    }
  }, "Ver Meu Perfil")) : null, org ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '15px 30px',
      background: 'var(--light)',
      borderBottom: '1px solid var(--gray5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, org.logo ? /*#__PURE__*/React.createElement("img", {
    src: org.logo,
    alt: "",
    style: {
      width: 32,
      height: 32,
      objectFit: 'contain'
    }
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--darkPurple1)'
    }
  }, org.name)), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--menu-link-color)',
      textDecoration: 'none'
    }
  }, "GERENCIAR")) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 0',
      overflowY: 'auto',
      flex: 1
    }
  }, sections.map((s, si) => /*#__PURE__*/React.createElement("div", {
    key: si
  }, s.label ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 30px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--gray3)'
    }
  }, s.label) : null, (s.items || []).map((it, i) => {
    const key = si + '-' + i;
    return /*#__PURE__*/React.createElement("a", {
      key: key,
      href: "#",
      onClick: e => {
        e.preventDefault();
        it.onClick && it.onClick();
      },
      onMouseEnter: () => setHover(key),
      onMouseLeave: () => setHover(null),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 15,
        padding: '12px 30px',
        textDecoration: 'none',
        color: 'var(--dark)',
        transition: 'background .2s',
        background: hover === key ? 'var(--light)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 10,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: it.color || 'var(--iconPurple)',
        color: '#fff'
      }
    }, it.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 600
      }
    }, it.label));
  }))))));
}
Object.assign(__ds_scope, { NavDrawer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavDrawer.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Pagination.jsx
try { (() => {
function Pagination({
  page = 1,
  pages = 1,
  onChange,
  perPage,
  perPageOptions = [10, 25, 50],
  onPerPageChange,
  style
}) {
  const btn = (label, on, click, key) => /*#__PURE__*/React.createElement("button", {
    key: key,
    type: "button",
    onClick: click,
    style: {
      width: 32,
      height: 32,
      borderRadius: 6,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontWeight: 600,
      border: '1px solid ' + (on ? 'var(--lightPurple1)' : 'var(--gray5)'),
      background: on ? 'var(--lightPurple1)' : 'var(--white)',
      color: on ? '#fff' : 'var(--darkPurple1)'
    }
  }, label);
  const nums = [];
  for (let i = 1; i <= pages; i += 1) nums.push(btn(i, i === page, () => onChange && onChange(i), i));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 20,
      padding: '0 10px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--gray)'
    }
  }, "Resultados por p\xE1gina:"), /*#__PURE__*/React.createElement("select", {
    value: perPage,
    onChange: onPerPageChange,
    style: {
      width: 70,
      padding: '8px 10px',
      borderRadius: 8,
      border: '1px solid var(--lightBorder)',
      background: 'var(--light)',
      color: 'var(--darkPurple1)',
      fontFamily: 'inherit',
      fontSize: 14
    }
  }, perPageOptions.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5
    }
  }, nums, btn('>', false, () => onChange && onChange(Math.min(pages, page + 1)), 'next')));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/** Page-level underline tabs (athlete detail, module headers). */
function Tabs({
  tabs = [],
  value,
  onChange,
  size = 'page',
  style
}) {
  const items = tabs.map(t => typeof t === 'string' ? {
    value: t,
    label: t
  } : t);
  const active = value != null ? value : items[0] && items[0].value;
  const [hover, setHover] = React.useState(null);
  const pad = size === 'page' ? '15px 30px' : '12px 25px';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      ...style
    }
  }, items.map(t => {
    const on = t.value === active;
    return /*#__PURE__*/React.createElement("div", {
      key: t.value,
      onClick: () => onChange && onChange(t.value),
      onMouseEnter: () => setHover(t.value),
      onMouseLeave: () => setHover(null),
      style: {
        position: 'relative',
        padding: pad,
        fontSize: 15,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        fontWeight: on ? 600 : 500,
        color: on ? 'var(--darkPurple1)' : hover === t.value ? 'var(--lightPurple1)' : 'var(--gray)',
        transition: 'color 0.2s'
      }
    }, t.label, on ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        bottom: size === 'page' ? -1 : 0,
        left: 0,
        width: '100%',
        height: size === 'page' ? 4 : 3,
        background: 'var(--lightPurple1)'
      }
    }) : null);
  }));
}

/** Detached tab buttons used in list filters and Últimas Movimentações. */
function TabButtons({
  tabs = [],
  value,
  onChange,
  style
}) {
  const items = tabs.map(t => typeof t === 'string' ? {
    value: t,
    label: t
  } : t);
  const active = value != null ? value : items[0] && items[0].value;
  const [hover, setHover] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      ...style
    }
  }, items.map(t => {
    const on = t.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      type: "button",
      onClick: () => onChange && onChange(t.value),
      onMouseEnter: () => setHover(t.value),
      onMouseLeave: () => setHover(null),
      style: {
        height: 40,
        padding: '0 24px',
        borderRadius: 8,
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        background: on ? 'var(--lightPurple4)' : hover === t.value ? 'var(--surface-hover)' : 'var(--white)',
        color: on ? 'var(--lightPurple1)' : 'var(--gray)',
        border: on ? '1px solid transparent' : '1px solid ' + (hover === t.value ? 'var(--gray3)' : 'var(--lightBorder)'),
        transition: 'background-color .2s, border-color .2s, color .2s'
      }
    }, t.label);
  }));
}
Object.assign(__ds_scope, { Tabs, TabButtons });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/footlink-scout/AppShell.jsx
try { (() => {
/* Shared shell: AppBar + NavDrawer + page header. Screens render inside <main>. */
const {
  AppBar,
  NavDrawer,
  Tabs,
  GenderSwitcher,
  Button
} = window.FootlinkDesignSystem_5f1c43;
const Icons = {
  search: /*#__PURE__*/React.createElement("path", {
    d: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
  }),
  feed: /*#__PURE__*/React.createElement("path", {
    d: "M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"
  }),
  clubs: /*#__PURE__*/React.createElement("path", {
    d: "M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.8L19.2 7 12 10.4 4.8 7 12 4.8zM4 16.2V8.4l7 3.3v7.8l-7-3.3zm9 3.3V11.7l7-3.3v7.8l-7 3.3z"
  }),
  trophy: /*#__PURE__*/React.createElement("path", {
    d: "M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1c2.45-.39 4.39-2.47 4.39-5.02V7c0-1.1-.9-2-2-2zM5 8V7h2v3.12C5.83 9.73 5 8.96 5 8zm14 0c0 .96-.83 1.73-2 2.12V7h2v1z"
  }),
  chart: /*#__PURE__*/React.createElement("path", {
    d: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"
  }),
  transfers: /*#__PURE__*/React.createElement("path", {
    d: "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6.29-6.29 4 4 6.3-6.29L22 12V6h-6z"
  }),
  agency: /*#__PURE__*/React.createElement("path", {
    d: "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm10 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2z"
  }),
  chat: /*#__PURE__*/React.createElement("path", {
    d: "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"
  }),
  bell: /*#__PURE__*/React.createElement("path", {
    d: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
  }),
  help: /*#__PURE__*/React.createElement("path", {
    d: "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"
  }),
  back: /*#__PURE__*/React.createElement("path", {
    d: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
  }),
  edit: /*#__PURE__*/React.createElement("path", {
    d: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.995.995 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
  }),
  report: /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
  }),
  send: /*#__PURE__*/React.createElement("path", {
    d: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
  }),
  image: /*#__PURE__*/React.createElement("path", {
    d: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
  }),
  clip: /*#__PURE__*/React.createElement("path", {
    d: "M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"
  })
};
const Icon = ({
  path,
  size = 20,
  color = 'currentColor'
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: color
}, path);
function ModuleIcon({
  path,
  color
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 10,
      background: color,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    path: path,
    size: 24
  }));
}
function PageHeader({
  icon,
  iconColor,
  title,
  description,
  tabs,
  tab,
  onTab
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--white)',
      padding: '24px 30px 0',
      borderBottom: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1400,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 15
    }
  }, /*#__PURE__*/React.createElement(ModuleIcon, {
    path: icon,
    color: iconColor
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 32,
      fontWeight: 700,
      color: 'var(--darkPurple1)'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--gray)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 700
    }
  }, description))), tabs ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 15
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    tabs: tabs,
    value: tab,
    onChange: onTab
  })) : null));
}
function AppShell({
  route,
  onRoute,
  children
}) {
  const [drawer, setDrawer] = React.useState(false);
  const [gender, setGender] = React.useState('MASC');
  const D = window.FLData;
  const iconFor = {
    feed: Icons.feed,
    athletes: Icons.search,
    clubs: Icons.clubs,
    competitions: Icons.trophy,
    analysis: Icons.chart,
    transfers: Icons.transfers,
    agencies: Icons.agency
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minHeight: '100%',
      background: 'var(--light)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    logoSrc: "../../assets/footlink-white-logo.svg",
    menuDot: true,
    onMenuClick: () => setDrawer(!drawer),
    center: /*#__PURE__*/React.createElement(GenderSwitcher, {
      value: gender,
      onChange: setGender
    }),
    user: "https://i.pravatar.cc/120?u=scout",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppBar.IconButton, {
      title: "Ajuda"
    }, /*#__PURE__*/React.createElement(Icon, {
      path: Icons.help
    })), /*#__PURE__*/React.createElement(AppBar.IconButton, {
      title: "Mensagens",
      onClick: () => onRoute('messages')
    }, /*#__PURE__*/React.createElement(Icon, {
      path: Icons.chat
    })), /*#__PURE__*/React.createElement(AppBar.IconButton, {
      title: "Notifica\xE7\xF5es",
      dot: true
    }, /*#__PURE__*/React.createElement(Icon, {
      path: Icons.bell
    })))
  }), children, /*#__PURE__*/React.createElement(NavDrawer, {
    open: drawer,
    onClose: () => setDrawer(false),
    user: {
      name: 'Fabiano Nadler',
      avatar: 'https://i.pravatar.cc/160?u=scout'
    },
    org: {
      name: 'CR Flamengo',
      logo: D.crest.fla
    },
    sections: [{
      label: 'Módulos',
      items: D.modules.map(m => ({
        label: m.label,
        color: m.color,
        icon: /*#__PURE__*/React.createElement(Icon, {
          path: iconFor[m.key]
        }),
        onClick: () => {
          setDrawer(false);
          onRoute(m.key === 'athletes' ? 'athletes' : m.key === 'competitions' ? 'competitions' : route);
        }
      }))
    }, {
      label: 'Trabalho',
      items: [{
        label: 'Projetos',
        color: 'var(--iconPurple)',
        icon: /*#__PURE__*/React.createElement(Icon, {
          path: Icons.chart
        }),
        onClick: () => {
          setDrawer(false);
          onRoute('workflow');
        }
      }, {
        label: 'Mensagens',
        color: 'var(--orange)',
        icon: /*#__PURE__*/React.createElement(Icon, {
          path: Icons.chat
        }),
        onClick: () => {
          setDrawer(false);
          onRoute('messages');
        }
      }]
    }]
  }));
}
Object.assign(window, {
  AppShell,
  PageHeader,
  Icons,
  Icon,
  ModuleIcon
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/footlink-scout/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/footlink-scout/AthleteDetailScreen.jsx
try { (() => {
/* /atleta/:id — sticky athlete header, info card, vínculo card, stat tables. */
const {
  Card,
  Button,
  Table,
  Tabs,
  Tooltip,
  Flag,
  MonitoringButton,
  Dialog
} = window.FootlinkDesignSystem_5f1c43;
const StatIcons = {
  minutes: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 9v4l2 2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 2h4"
  })),
  matches: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "3",
    width: "20",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "12",
    x2: "22",
    y2: "12"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  })),
  starter: /*#__PURE__*/React.createElement("path", {
    d: "M20.38 3.46L16 2H8L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"
  }),
  bench: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M18 10V4h-2v6h-4V4H8v6H4v8h16v-8h-2z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 18v2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 18v2"
  })),
  goals: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m12 2 3.5 3.5L12 9l-3.5-3.5L12 2Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m12 22 3.5-3.5L12 15l-3.5 3.5L12 22Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m22 12-3.5 3.5L15 12l3.5-3.5L22 12Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m2 12 3.5 3.5L9 12 5.5 8.5 2 12Z"
  }))
};
const StatIcon = ({
  path
}) => /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "var(--gray3)",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, path);
const Yellow = () => /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24"
}, /*#__PURE__*/React.createElement("rect", {
  x: "7",
  y: "4",
  width: "10",
  height: "16",
  rx: "2",
  fill: "#F2C94C"
}));
const DoubleYellow = () => /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24"
}, /*#__PURE__*/React.createElement("rect", {
  x: "5",
  y: "6",
  width: "10",
  height: "16",
  rx: "2",
  fill: "#F2C94C",
  opacity: ".6"
}), /*#__PURE__*/React.createElement("rect", {
  x: "9",
  y: "4",
  width: "10",
  height: "16",
  rx: "2",
  fill: "#F2C94C",
  stroke: "#fff",
  strokeWidth: "1"
}));
const Red = () => /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24"
}, /*#__PURE__*/React.createElement("rect", {
  x: "7",
  y: "4",
  width: "10",
  height: "16",
  rx: "2",
  fill: "#EB5757"
}));
const Dot = ({
  color
}) => /*#__PURE__*/React.createElement("svg", {
  width: "12",
  height: "12",
  viewBox: "0 0 24 24",
  fill: color
}, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "10"
}));
const IconHead = ({
  icon,
  label
}) => /*#__PURE__*/React.createElement(Tooltip, {
  label: label
}, /*#__PURE__*/React.createElement("span", {
  style: {
    display: 'flex',
    height: 24,
    alignItems: 'center',
    cursor: 'help'
  }
}, icon));
function InfoRow({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 0',
      borderBottom: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--gray)',
      flexShrink: 0
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--darkPurple1)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      textAlign: 'right'
    }
  }, children));
}
function ContractBlock({
  label,
  name,
  crest,
  end,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, crest ? /*#__PURE__*/React.createElement("img", {
    src: crest,
    alt: "",
    style: {
      width: 32,
      height: 32,
      objectFit: 'contain'
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: 'var(--gray3)',
      lineHeight: 1
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--darkPurple1)',
      lineHeight: 1.2
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--gray)',
      lineHeight: 1.2
    }
  }, end || '\u00a0'))), action ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, action) : null);
}
function AthleteDetailScreen({
  athleteId,
  onBack
}) {
  const D = window.FLData;
  const a = D.athletes.find(x => x.id === athleteId) || D.athletes[0];
  const [tab, setTab] = React.useState('Visão Geral');
  const [mon, setMon] = React.useState(a.monitoring);
  const [dialog, setDialog] = React.useState(false);
  const chat = /*#__PURE__*/React.createElement(Button, {
    color: "secondary",
    noShadow: true,
    style: {
      height: 24,
      padding: '0 20px',
      fontSize: 12,
      borderRadius: 6,
      background: 'transparent'
    }
  }, "Falar com clube");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--white)',
      padding: '12px 30px 0',
      borderBottom: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1400,
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 25,
      flexGrow: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBack,
    title: "Voltar",
    style: {
      width: 48,
      height: 48,
      borderRadius: 12,
      border: '1px solid var(--gray5)',
      background: 'none',
      color: 'var(--darkPurple1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    path: Icons.back,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 100,
      height: 100,
      borderRadius: '50%',
      overflow: 'hidden',
      border: '3px solid var(--white)',
      boxShadow: '0 4px 15px rgba(0,0,0,.1)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: a.photo,
    alt: a.nick,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 28,
      fontWeight: 700,
      color: 'var(--darkPurple1)',
      lineHeight: 1
    }
  }, a.nick), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--gray)',
      marginBottom: 4
    }
  }, a.full), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: 'var(--gray)',
      fontSize: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Flag, {
    code: a.nats[0].code,
    size: "xs"
  }), " Brasil"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gray5)',
      fontSize: 10
    }
  }, "\u2022"), /*#__PURE__*/React.createElement("span", null, a.age, " anos"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gray5)',
      fontSize: 10
    }
  }, "\u2022"), /*#__PURE__*/React.createElement("span", null, a.pos)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 30,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 25,
      paddingRight: 25,
      borderRight: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement(ContractBlock, {
    label: "Clube atual",
    name: a.club,
    crest: a.crest,
    end: 'Fim: ' + a.contract,
    action: chat
  }), /*#__PURE__*/React.createElement(ContractBlock, {
    label: "Ag\xEAncia",
    name: "ROC NATION",
    end: "",
    action: chat
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Tooltip, {
    label: "Gerar relat\xF3rio",
    position: "top"
  }, /*#__PURE__*/React.createElement(Button, {
    color: "secondary",
    style: {
      width: 42,
      height: 42,
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    path: Icons.report,
    size: 24
  }))), /*#__PURE__*/React.createElement(Tooltip, {
    label: "Notificar",
    position: "top"
  }, /*#__PURE__*/React.createElement(Button, {
    color: "secondary",
    style: {
      width: 42,
      height: 42,
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    path: Icons.bell,
    size: 24
  }))), /*#__PURE__*/React.createElement(MonitoringButton, {
    size: "lg",
    monitoring: mon,
    onToggle: () => setMon(!mon),
    onOpenLists: () => setDialog(true)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1400,
      margin: '12px auto 0'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    size: "compact",
    tabs: ['Visão Geral', 'Anotações', 'Avaliações', 'Carreira', 'Desempenho', 'Jogos', 'Vídeos'],
    value: tab,
    onChange: setTab
  }))), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 1400,
      margin: '0 auto',
      padding: '20px 30px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      gridColumn: 'span 4',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Informa\xE7\xF5es do atleta"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(InfoRow, {
    label: "Nome completo"
  }, a.full), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Data de nascimento"
  }, a.birth), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Idade"
  }, a.age, " anos"), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Altura"
  }, a.height), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Peso"
  }, a.weight), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Posi\xE7\xE3o"
  }, a.pos), /*#__PURE__*/React.createElement(InfoRow, {
    label: "P\xE9 preferencial"
  }, a.foot), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Nacionalidade"
  }, /*#__PURE__*/React.createElement(Flag, {
    code: a.nats[0].code,
    size: "xs"
  }), " Brasil")), /*#__PURE__*/React.createElement(Button, {
    color: "secondary",
    fluid: true,
    style: {
      marginTop: 16
    },
    iconLeft: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, Icons.edit)
  }, "Editar dados do atleta")), /*#__PURE__*/React.createElement(Card, {
    title: "V\xEDnculo"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '15px 0',
      borderBottom: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement(ContractBlock, {
    label: "Contrato atual",
    name: a.club,
    crest: a.crest,
    end: 'Fim: ' + a.contract
  }), /*#__PURE__*/React.createElement(Button, {
    color: "secondary",
    smaller: true,
    fluid: true,
    style: {
      marginTop: 12
    }
  }, "Falar com clube")), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 15
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: 'var(--gray3)',
      display: 'block',
      marginBottom: 10
    }
  }, "Ag\xEAncia"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 15
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 8,
      border: '1px solid var(--gray5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--gray)'
    }
  }, "RN"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--darkPurple1)'
    }
  }, "ROC NATION")), /*#__PURE__*/React.createElement(Button, {
    color: "secondary",
    smaller: true,
    fluid: true,
    style: {
      marginTop: 12
    }
  }, "Falar com ag\xEAncia")))), /*#__PURE__*/React.createElement("section", {
    style: {
      gridColumn: 'span 8',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Desempenho recente",
    footer: /*#__PURE__*/React.createElement("a", {
      href: "#",
      onClick: e => e.preventDefault(),
      style: {
        color: 'var(--lightPurple1)',
        fontSize: 14,
        fontWeight: 700
      }
    }, "Ver desempenho completo")
  }, /*#__PURE__*/React.createElement(Table, {
    density: "compact",
    columns: [{
      key: 'season',
      label: 'Temporada'
    }, {
      key: 'comp',
      label: 'Competição'
    }, {
      key: 'club',
      label: 'Clube'
    }, {
      key: 'min',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.minutes
        }),
        label: "Minutos jogados"
      }),
      align: 'center'
    }, {
      key: 'games',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.matches
        }),
        label: "Partidas jogadas"
      }),
      align: 'center'
    }, {
      key: 'start',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.starter
        }),
        label: "Jogos como titular"
      }),
      align: 'center'
    }, {
      key: 'bench',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.bench
        }),
        label: "Jogos no banco"
      }),
      align: 'center'
    }, {
      key: 'goals',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.goals
        }),
        label: "Gols"
      }),
      align: 'center'
    }, {
      key: 'yc',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(Yellow, null),
        label: "Cart\xF5es amarelos"
      }),
      align: 'center'
    }, {
      key: 'dyc',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(DoubleYellow, null),
        label: "Amarelos duplos"
      }),
      align: 'center'
    }, {
      key: 'rc',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(Red, null),
        label: "Cart\xF5es vermelhos"
      }),
      align: 'center'
    }],
    rows: D.performance.map(r => ({
      season: r[0],
      comp: r[1],
      club: /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 5
        }
      }, /*#__PURE__*/React.createElement("img", {
        src: r[3],
        alt: "",
        style: {
          width: 16,
          height: 16,
          objectFit: 'contain'
        }
      }), r[2]),
      min: r[4],
      games: r[5],
      start: r[6],
      bench: r[7],
      goals: r[8],
      yc: r[9],
      dyc: r[10],
      rc: r[11]
    }))
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Jogos recentes",
    footer: /*#__PURE__*/React.createElement("a", {
      href: "#",
      onClick: e => e.preventDefault(),
      style: {
        color: 'var(--lightPurple1)',
        fontSize: 14,
        fontWeight: 700
      }
    }, "Ver todos os jogos")
  }, /*#__PURE__*/React.createElement(Table, {
    density: "compact",
    columns: [{
      key: 'date',
      label: 'Data'
    }, {
      key: 'comp',
      label: 'Competição'
    }, {
      key: 'home',
      label: 'Casa'
    }, {
      key: 'res',
      label: 'Res',
      align: 'center'
    }, {
      key: 'away',
      label: 'Fora'
    }, {
      key: 'min',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.minutes
        }),
        label: "Minutos jogados"
      }),
      align: 'center'
    }, {
      key: 'start',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.starter
        }),
        label: "Titular"
      }),
      align: 'center'
    }, {
      key: 'bench',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.bench
        }),
        label: "Banco"
      }),
      align: 'center'
    }, {
      key: 'goals',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(StatIcon, {
          path: StatIcons.goals
        }),
        label: "Gols"
      }),
      align: 'center'
    }, {
      key: 'yc',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(Yellow, null),
        label: "Cart\xE3o amarelo"
      }),
      align: 'center'
    }, {
      key: 'rc',
      label: /*#__PURE__*/React.createElement(IconHead, {
        icon: /*#__PURE__*/React.createElement(Red, null),
        label: "Cart\xE3o vermelho"
      }),
      align: 'center'
    }],
    rows: D.matches.map(r => ({
      date: r[0],
      comp: r[1],
      home: /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 5
        }
      }, /*#__PURE__*/React.createElement("img", {
        src: r[3],
        alt: "",
        style: {
          width: 16,
          height: 16,
          objectFit: 'contain'
        }
      }), r[2]),
      res: r[4],
      away: /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 5
        }
      }, /*#__PURE__*/React.createElement("img", {
        src: r[6],
        alt: "",
        style: {
          width: 16,
          height: 16,
          objectFit: 'contain'
        }
      }), r[5]),
      min: r[7],
      start: r[8] ? /*#__PURE__*/React.createElement(Dot, {
        color: "var(--green1)"
      }) : '-',
      bench: r[9] ? /*#__PURE__*/React.createElement(Dot, {
        color: "var(--orange2)"
      }) : '-',
      goals: r[10],
      yc: r[11] ? /*#__PURE__*/React.createElement(Yellow, null) : '-',
      rc: r[13] ? /*#__PURE__*/React.createElement(Red, null) : '-'
    }))
  }))))), /*#__PURE__*/React.createElement(Dialog, {
    open: dialog,
    title: "Adicionar \xE0s listas",
    onClose: () => setDialog(false),
    width: 360,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      color: "white",
      smaller: true,
      noShadow: true,
      onClick: () => setDialog(false)
    }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
      color: "green",
      smaller: true,
      noShadow: true,
      onClick: () => setDialog(false)
    }, "Salvar"))
  }, ['Observação Sub-20', 'Potenciais contratações', 'Elite europeia'].map(l => /*#__PURE__*/React.createElement("label", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 14,
      color: 'var(--darkPurple1)',
      marginBottom: 12,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    style: {
      width: 18,
      height: 18,
      accentColor: 'var(--lightPurple1)'
    }
  }), " ", l))));
}
Object.assign(window, {
  AthleteDetailScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/footlink-scout/AthleteDetailScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/footlink-scout/AthletesScreen.jsx
try { (() => {
/* /busca-avancada — filter aside + institutional athlete table. */
const {
  Table,
  AthleteCell,
  ClubCell,
  NationalitiesRow,
  MonitoringButton,
  Input,
  Select,
  SegmentedToggle,
  Pagination,
  Card,
  Button,
  Badge,
  EmptyState
} = window.FootlinkDesignSystem_5f1c43;
function FilterGroup({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--gray)'
    }
  }, label), children);
}
function AthletesScreen({
  onOpenAthlete
}) {
  const D = window.FLData;
  const [sort, setSort] = React.useState({
    key: 'age',
    dir: 'asc'
  });
  const [gender, setGender] = React.useState('Masculino');
  const [q, setQ] = React.useState('');
  const [mon, setMon] = React.useState(() => {
    const m = {};
    D.athletes.forEach(a => {
      m[a.id] = a.monitoring;
    });
    return m;
  });
  const [page, setPage] = React.useState(1);
  const list = D.athletes.filter(a => (a.nick + ' ' + a.full).toLowerCase().includes(q.toLowerCase()));
  const sorted = [...list].sort((a, b) => {
    const dir = sort.dir === 'desc' ? -1 : 1;
    if (sort.key === 'age') return (a.age - b.age) * dir;
    if (sort.key === 'club') return a.club.localeCompare(b.club) * dir;
    return a.nick.localeCompare(b.nick) * dir;
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    icon: Icons.search,
    iconColor: "var(--iconGreen)",
    title: "Busca avan\xE7ada",
    description: "Filtre por posi\xE7\xE3o, idade, nacionalidade e situa\xE7\xE3o contratual para montar sua lista de observa\xE7\xE3o.",
    tabs: ['Atletas', 'Clubes', 'Listas salvas'],
    tab: "Atletas",
    onTab: () => {}
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 1400,
      margin: '0 auto',
      padding: '20px 30px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: 30
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      gridColumn: 'span 3'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--darkPurple1)'
    }
  }, "Filtros"), /*#__PURE__*/React.createElement(Button, {
    color: "link",
    smaller: true,
    noShadow: true,
    style: {
      padding: 0
    }
  }, "Limpar")), /*#__PURE__*/React.createElement(FilterGroup, {
    label: "Divis\xE3o"
  }, /*#__PURE__*/React.createElement(SegmentedToggle, {
    options: ['Masculino', 'Feminino'],
    value: gender,
    onChange: setGender
  })), /*#__PURE__*/React.createElement(FilterGroup, {
    label: "Nome"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Apelido ou nome completo",
    value: q,
    onChange: e => setQ(e.target.value),
    iconLeft: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, Icons.search)
  })), /*#__PURE__*/React.createElement(FilterGroup, {
    label: "Posi\xE7\xE3o"
  }, /*#__PURE__*/React.createElement(Select, {
    placeholder: "Todas as posi\xE7\xF5es",
    options: ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Ponta', 'Atacante'],
    style: {
      width: '100%'
    }
  })), /*#__PURE__*/React.createElement(FilterGroup, {
    label: "Faixa de idade"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "15",
    wrapperStyle: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: "40",
    wrapperStyle: {
      flex: 1
    }
  }))), /*#__PURE__*/React.createElement(FilterGroup, {
    label: "Nacionalidade"
  }, /*#__PURE__*/React.createElement(Select, {
    placeholder: "Todos os pa\xEDses",
    options: ['Brasil', 'Argentina', 'Portugal', 'Espanha'],
    style: {
      width: '100%'
    }
  })), /*#__PURE__*/React.createElement(FilterGroup, {
    label: "Fim de contrato"
  }, /*#__PURE__*/React.createElement(Select, {
    placeholder: "Qualquer data",
    options: ['2025', '2026', '2027', '2028+'],
    style: {
      width: '100%'
    }
  })), /*#__PURE__*/React.createElement(Button, {
    color: "green",
    fluid: true
  }, "Aplicar filtros"))), /*#__PURE__*/React.createElement("section", {
    style: {
      gridColumn: 'span 9',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--gray)'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--darkPurple1)'
    }
  }, sorted.length), " atletas encontrados"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    color: "white",
    smaller: true
  }, "Exportar"), /*#__PURE__*/React.createElement(Button, {
    color: "secondary",
    smaller: true
  }, "Salvar busca"))), /*#__PURE__*/React.createElement(Table, {
    stickyHeader: true,
    sort: sort,
    onSortChange: setSort,
    emptyState: /*#__PURE__*/React.createElement(EmptyState, {
      icon: /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 24 24",
        fill: "currentColor"
      }, Icons.search),
      title: "Nenhum atleta encontrado",
      description: "Ajuste os filtros e tente novamente."
    }),
    columns: [{
      key: 'athlete',
      label: 'Atleta'
    }, {
      key: 'club',
      label: 'Clube'
    }, {
      key: 'age',
      label: 'Idade',
      align: 'center'
    }, {
      key: 'pos',
      label: 'Posição'
    }, {
      key: 'nat',
      label: 'Nac.',
      sortable: false
    }, {
      key: 'contract',
      label: 'Contrato'
    }, {
      key: 'mon',
      label: '',
      sortable: false
    }],
    rows: sorted.map(a => ({
      athlete: /*#__PURE__*/React.createElement("span", {
        onClick: () => onOpenAthlete(a.id),
        style: {
          cursor: 'pointer'
        }
      }, /*#__PURE__*/React.createElement(AthleteCell, {
        nickname: a.nick,
        fullName: a.full,
        avatar: a.photo
      })),
      club: /*#__PURE__*/React.createElement(ClubCell, {
        name: a.club,
        crest: a.crest
      }),
      age: a.age,
      pos: a.pos,
      nat: /*#__PURE__*/React.createElement(NationalitiesRow, {
        nationalities: a.nats
      }),
      contract: a.contract,
      mon: /*#__PURE__*/React.createElement(MonitoringButton, {
        size: "sm",
        monitoring: !!mon[a.id],
        onToggle: () => setMon({
          ...mon,
          [a.id]: !mon[a.id]
        })
      })
    }))
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    pages: 3,
    onChange: setPage,
    perPage: 10
  })))));
}
Object.assign(window, {
  AthletesScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/footlink-scout/AthletesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/footlink-scout/CompetitionsScreen.jsx
try { (() => {
/* /competicoes — filter bar over a full-width institutional table. */
const {
  Table,
  StatusPill,
  Input,
  Select,
  SegmentedToggle,
  Pagination,
  CountryRow,
  Card
} = window.FootlinkDesignSystem_5f1c43;
function CompetitionsScreen() {
  const D = window.FLData;
  const [sort, setSort] = React.useState({
    key: 'comp',
    dir: 'none'
  });
  const [gender, setGender] = React.useState('Masculino');
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const rows = D.competitions.filter(c => c[1].toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    icon: Icons.trophy,
    iconColor: "var(--orange)",
    title: "Competi\xE7\xF5es",
    description: "Acompanhe o desempenho de atletas em todas as categorias e fases das competi\xE7\xF5es nacionais e internacionais.",
    tabs: ['Temporada atual', 'Profissional', 'Sub-23', 'Sub-20', 'Sub-17', 'Sub-15', 'Sub-14', 'Sub-13', 'Sub-12', 'Sub-10', 'Sub-9'],
    tab: "Temporada atual",
    onTab: () => {}
  }), /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(Card, {
    padding: 30,
    style: {
      margin: '20px 30px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 15,
      alignItems: 'flex-end',
      boxShadow: 'var(--shadow-table)'
    }
  }, /*#__PURE__*/React.createElement(SegmentedToggle, {
    options: ['Masculino', 'Feminino'],
    value: gender,
    onChange: setGender
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Pesquisar por nome da competi\xE7\xE3o...",
    value: q,
    onChange: e => setQ(e.target.value),
    wrapperStyle: {
      flexGrow: 1,
      minWidth: 220
    }
  }), /*#__PURE__*/React.createElement(Select, {
    placeholder: "Filtrar por Estado",
    options: ['Todos os Estados', 'Rio de Janeiro', 'São Paulo', 'Minas Gerais'],
    style: {
      width: 170
    }
  }), /*#__PURE__*/React.createElement(Select, {
    placeholder: "Categoria",
    options: ['Todas', 'Profissional', 'Sub-23', 'Sub-20'],
    style: {
      width: 140
    }
  }), /*#__PURE__*/React.createElement(Select, {
    placeholder: "Status",
    options: ['Todos', 'Em andamento', 'Concluídas', 'Não iniciada'],
    style: {
      width: 140
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 30px 40px'
    }
  }, /*#__PURE__*/React.createElement(Table, {
    stickyHeader: true,
    sort: sort,
    onSortChange: setSort,
    columns: [{
      key: 'fed',
      label: 'Fed.',
      sortable: false,
      width: 60
    }, {
      key: 'comp',
      label: 'Competição'
    }, {
      key: 'org',
      label: 'Organizador'
    }, {
      key: 'country',
      label: 'País'
    }, {
      key: 'scope',
      label: 'Âmbito'
    }, {
      key: 'cat',
      label: 'Cat.'
    }, {
      key: 'clubs',
      label: 'Clubes',
      align: 'center'
    }, {
      key: 'start',
      label: 'Início'
    }, {
      key: 'end',
      label: 'Fim'
    }, {
      key: 'status',
      label: 'Status'
    }],
    rows: rows.map(c => ({
      fed: /*#__PURE__*/React.createElement("img", {
        src: c[0],
        alt: "",
        style: {
          width: 24,
          height: 24,
          objectFit: 'contain'
        }
      }),
      comp: /*#__PURE__*/React.createElement("a", {
        href: "#",
        onClick: e => e.preventDefault(),
        style: {
          color: 'var(--link-color)',
          fontWeight: 600,
          fontSize: 13
        }
      }, c[1]),
      org: c[2],
      country: /*#__PURE__*/React.createElement(CountryRow, {
        code: c[3],
        name: c[4]
      }),
      scope: c[5],
      cat: c[6],
      clubs: c[7],
      start: c[8],
      end: c[9],
      status: /*#__PURE__*/React.createElement(StatusPill, {
        status: c[10]
      }, c[11])
    }))
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    pages: 3,
    onChange: setPage,
    perPage: 10
  }))));
}
Object.assign(window, {
  CompetitionsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/footlink-scout/CompetitionsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/footlink-scout/MessagesScreen.jsx
try { (() => {
/* /mensagens — three-panel shell: category menu, conversation sidebar, chat. */
const {
  ChatMessage,
  DatePill,
  Input,
  Button,
  AthleteCard,
  EmptyState,
  CountBadge
} = window.FootlinkDesignSystem_5f1c43;
function MenuItem({
  label,
  color,
  active,
  onClick,
  icon
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 8,
      cursor: 'pointer',
      borderLeft: '3px solid ' + (active ? 'var(--lightPurple1)' : 'transparent'),
      paddingLeft: active ? 11 : 10,
      background: active ? 'var(--nav-active-bg)' : hover ? 'var(--surface-hover)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: color,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    path: icon,
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: active ? 'var(--lightPurple1)' : 'var(--darkPurple1)'
    }
  }, label));
}
function ConversationRow({
  c,
  active,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      gap: 12,
      padding: '12px 14px',
      cursor: 'pointer',
      borderLeft: '3px solid ' + (active ? 'var(--lightPurple1)' : 'transparent'),
      paddingLeft: active ? 11 : 14,
      background: active ? 'var(--nav-active-bg)' : hover ? 'var(--surface-hover)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 44,
      height: 44,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: c.avatar,
    alt: "",
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      objectFit: 'cover'
    }
  }), c.shield ? /*#__PURE__*/React.createElement("img", {
    src: c.shield,
    alt: "",
    style: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 16,
      height: 16,
      borderRadius: 3,
      border: '1.5px solid var(--white)',
      background: '#fff',
      objectFit: 'contain'
    }
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--darkPurple1)'
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--gray3)',
      flexShrink: 0
    }
  }, c.date)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--gray)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, c.preview), c.unread ? /*#__PURE__*/React.createElement(CountBadge, {
    count: c.unread,
    tone: "danger"
  }) : null)));
}
function MessagesScreen() {
  const D = window.FLData;
  const [cat, setCat] = React.useState('Clubes');
  const [conv, setConv] = React.useState('fla');
  const [draft, setDraft] = React.useState('');
  const [msgs, setMsgs] = React.useState(D.messages);
  const active = D.conversations.find(c => c.id === conv);
  const wesley = D.athletes.find(a => a.id === 'wesley');
  const send = () => {
    if (!draft.trim()) return;
    setMsgs([...msgs, {
      type: 'sent',
      text: draft,
      time: '14:12'
    }]);
    setDraft('');
  };
  return /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 1720,
      margin: '0 auto',
      display: 'flex',
      height: 'calc(100vh - 90px)',
      minHeight: 620,
      padding: '15px 0',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      minWidth: 180,
      maxWidth: 200,
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--gray3)',
      padding: '4px 10px 8px'
    }
  }, "Conversas"), /*#__PURE__*/React.createElement(MenuItem, {
    label: "Negocia\xE7\xF5es",
    color: "var(--orange)",
    icon: Icons.transfers,
    active: cat === 'Negociações',
    onClick: () => setCat('Negociações')
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: "Atletas",
    color: "var(--lightPurple1)",
    icon: Icons.search,
    active: cat === 'Atletas',
    onClick: () => setCat('Atletas')
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: "Clubes",
    color: "var(--green1)",
    icon: Icons.clubs,
    active: cat === 'Clubes',
    onClick: () => setCat('Clubes')
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: "Agentes",
    color: "#62747c",
    icon: Icons.agency,
    active: cat === 'Agentes',
    onClick: () => setCat('Agentes')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      background: 'var(--white)',
      border: '1px solid var(--gray5)',
      borderRadius: 12,
      overflow: 'hidden',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 320,
      borderRight: '1px solid var(--gray5)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      borderBottom: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Buscar conversa",
    rounded: true,
    iconLeft: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, Icons.search)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowY: 'auto',
      flex: 1
    }
  }, D.conversations.map(c => /*#__PURE__*/React.createElement(ConversationRow, {
    key: c.id,
    c: c,
    active: c.id === conv,
    onClick: () => setConv(c.id)
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 16px',
      borderBottom: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: active.avatar,
    alt: "",
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      objectFit: 'cover'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--darkPurple1)'
    }
  }, active.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--gray)'
    }
  }, active.full))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, active.shield ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: active.shield,
    alt: "",
    style: {
      width: 28,
      height: 28,
      borderRadius: 4,
      background: 'var(--gray6)',
      border: '1px solid var(--gray5)',
      objectFit: 'contain'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--darkPurple1)'
    }
  }, active.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--gray)'
    }
  }, "Contrato at\xE9 31/12/2027"))) : null, /*#__PURE__*/React.createElement(Button, {
    color: "secondary",
    smaller: true,
    noShadow: true,
    style: {
      height: 36
    }
  }, "Ver perfil"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 16,
      background: 'var(--white)'
    }
  }, /*#__PURE__*/React.createElement(DatePill, null, "Hoje"), msgs.map((m, i) => /*#__PURE__*/React.createElement(ChatMessage, {
    key: i,
    type: m.type,
    sender: m.sender,
    text: m.text,
    time: m.time,
    avatar: m.type === 'received' ? active.avatar : undefined,
    shield: m.type === 'received' ? active.shield : undefined
  }, m.card === 'wesley' ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      minWidth: 300
    }
  }, /*#__PURE__*/React.createElement(AthleteCard, {
    nickname: wesley.nick,
    fullName: wesley.full,
    avatar: wesley.photo,
    shield: wesley.crest,
    nationality: "br",
    meta: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, wesley.age, " anos"), /*#__PURE__*/React.createElement("span", null, wesley.posShort))
  })) : null))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 16px',
      background: 'var(--chat-footer-bg)',
      borderTop: '1px solid var(--gray5)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      width: 32,
      height: 32,
      borderRadius: 6,
      border: 'none',
      background: 'transparent',
      color: 'var(--gray)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    path: Icons.image,
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      width: 32,
      height: 32,
      borderRadius: 6,
      border: 'none',
      background: 'transparent',
      color: 'var(--gray)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    path: Icons.clip,
    size: 16
  })), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Escreva uma mensagem\u2026",
    value: draft,
    onChange: e => setDraft(e.target.value),
    wrapperStyle: {
      flex: 1
    },
    style: {
      fontSize: 14
    }
  }), /*#__PURE__*/React.createElement(Button, {
    color: "green",
    noShadow: true,
    onClick: send,
    style: {
      width: 40,
      height: 40,
      padding: 0,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    path: Icons.send,
    size: 16
  }))))));
}
Object.assign(window, {
  MessagesScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/footlink-scout/MessagesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/footlink-scout/WorkflowScreen.jsx
try { (() => {
/* /projetos/:id/workflow — kanban board of scouting stages. */
const {
  KanbanColumn,
  AddColumnButton,
  AthleteCard,
  Button,
  Badge
} = window.FootlinkDesignSystem_5f1c43;
function WorkflowScreen() {
  const D = window.FLData;
  const initial = [{
    id: 'obs',
    title: 'Observação',
    ids: ['estevao', 'wesley', 'ayrton'],
    variants: {
      estevao: 'yellow',
      wesley: 'blue'
    }
  }, {
    id: 'ana',
    title: 'Em análise',
    ids: ['ortiz', 'endrick'],
    variants: {
      ortiz: 'gray',
      endrick: 'green'
    }
  }, {
    id: 'apr',
    title: 'Aprovado',
    ids: ['pedro'],
    variants: {
      pedro: 'green'
    }
  }, {
    id: 'neg',
    title: 'Negociação',
    ids: ['vini'],
    variants: {
      vini: 'red'
    }
  }];
  const [cols, setCols] = React.useState(initial);
  const [picked, setPicked] = React.useState(null);
  const byId = id => D.athletes.find(a => a.id === id);
  const move = colId => {
    if (!picked) return;
    setCols(cols.map(c => {
      if (c.id === picked.col) return {
        ...c,
        ids: c.ids.filter(i => i !== picked.id)
      };
      if (c.id === colId) return {
        ...c,
        ids: [...c.ids, picked.id],
        variants: {
          ...c.variants,
          [picked.id]: picked.variant
        }
      };
      return c;
    }));
    setPicked(null);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    icon: Icons.chart,
    iconColor: "var(--iconPurple)",
    title: "Workflow \u2014 Base 2025",
    description: "Arraste atletas entre as etapas do projeto. Clique em um card e depois na coluna de destino.",
    tabs: ['Workflow', 'Atletas', 'Relatórios', 'Configurações'],
    tab: "Workflow",
    onTab: () => {}
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      padding: '20px 30px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "purple"
  }, cols.reduce((n, c) => n + c.ids.length, 0), " atletas no projeto"), picked ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--lightPurple1)',
      fontWeight: 600
    }
  }, byId(picked.id).nick, " selecionado \u2014 escolha a coluna de destino") : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    color: "white",
    smaller: true
  }, "Exportar board"), /*#__PURE__*/React.createElement(Button, {
    color: "green",
    smaller: true
  }, "Adicionar atleta")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
      overflowX: 'auto',
      paddingBottom: 8,
      height: 520
    }
  }, cols.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    onClick: () => picked && picked.col !== c.id && move(c.id),
    style: {
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement(KanbanColumn, {
    title: c.title,
    count: c.ids.length,
    onAddAthlete: () => {},
    onMenu: () => {},
    style: {
      height: '100%',
      outline: picked && picked.col !== c.id ? '2px dashed var(--lightPurple1)' : 'none',
      outlineOffset: 2
    }
  }, c.ids.map(id => {
    const a = byId(id);
    const variant = c.variants && c.variants[id] || 'gray';
    const on = picked && picked.id === id;
    return /*#__PURE__*/React.createElement("div", {
      key: id,
      onClick: e => {
        e.stopPropagation();
        setPicked(on ? null : {
          id,
          col: c.id,
          variant
        });
      },
      style: {
        cursor: 'pointer',
        transform: on ? 'scale(0.98)' : 'none',
        transition: 'transform .15s'
      }
    }, /*#__PURE__*/React.createElement(AthleteCard, {
      variant: variant,
      nickname: a.nick,
      fullName: a.full,
      avatar: a.photo,
      shield: a.crest,
      nationality: a.nats[0].code,
      rating: a.rating,
      showColorDot: true,
      meta: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, a.birth.slice(6), " \xB7 ", a.age, " anos"), /*#__PURE__*/React.createElement("span", null, a.posShort)),
      style: on ? {
        borderColor: 'var(--lightPurple1)'
      } : null
    }));
  })))), /*#__PURE__*/React.createElement(AddColumnButton, {
    onClick: () => setCols([...cols, {
      id: 'c' + cols.length,
      title: 'Nova etapa',
      ids: [],
      variants: {}
    }])
  }))));
}
Object.assign(window, {
  WorkflowScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/footlink-scout/WorkflowScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/footlink-scout/data.js
try { (() => {
window.FLData = (() => {
  const crest = {
    fla: 'https://logodetimes.com/times/flamengo/logo-flamengo-256.png',
    rma: 'https://logodetimes.com/times/real-madrid/logo-real-madrid-256.png',
    bar: 'https://logodetimes.com/times/barcelona/logo-barcelona-256.png',
    mci: 'https://logodetimes.com/times/manchester-city/logo-manchester-city-256.png',
    pal: 'https://logodetimes.com/times/palmeiras/logo-palmeiras-256.png',
    cbf: 'https://upload.wikimedia.org/wikipedia/pt/f/f2/Cbf_logo.png',
    fpf: 'https://upload.wikimedia.org/wikipedia/pt/e/e5/Logo_fpf.png'
  };
  const pic = k => 'https://i.pravatar.cc/160?u=' + k;
  const athletes = [{
    id: 'vini',
    nick: 'Vini Jr.',
    full: 'Vinícius José Paixão de Oliveira Júnior',
    club: 'Real Madrid',
    crest: crest.rma,
    birth: '12/07/2000',
    age: 23,
    pos: 'Ponta Esquerda',
    posShort: 'PE',
    foot: 'Destro',
    height: '1,76 m',
    weight: '73 kg',
    nats: [{
      code: 'br',
      name: 'Brasil'
    }],
    contract: '30/06/2027',
    photo: pic('vini'),
    monitoring: true,
    rating: 5
  }, {
    id: 'pedro',
    nick: 'Pedro',
    full: 'Pedro Guilherme Abreu dos Santos',
    club: 'CR Flamengo',
    crest: crest.fla,
    birth: '20/06/1997',
    age: 27,
    pos: 'Atacante',
    posShort: 'ATA',
    foot: 'Destro',
    height: '1,83 m',
    weight: '78 kg',
    nats: [{
      code: 'br',
      name: 'Brasil'
    }, {
      code: 'it',
      name: 'Itália'
    }],
    contract: '31/12/2027',
    photo: pic('pedro'),
    monitoring: false,
    rating: 4
  }, {
    id: 'ortiz',
    nick: 'Léo Ortiz',
    full: 'Leonardo Ortiz Ferreira',
    club: 'CR Flamengo',
    crest: crest.fla,
    birth: '02/01/1996',
    age: 28,
    pos: 'Zagueiro',
    posShort: 'ZAG',
    foot: 'Destro',
    height: '1,85 m',
    weight: '80 kg',
    nats: [{
      code: 'br'
    }, {
      code: 'es'
    }, {
      code: 'pt'
    }, {
      code: 'it'
    }],
    contract: '31/12/2028',
    photo: pic('ortiz'),
    monitoring: false,
    rating: 4
  }, {
    id: 'wesley',
    nick: 'Wesley',
    full: 'Wesley França Lima',
    club: 'CR Flamengo',
    crest: crest.fla,
    birth: '17/09/2003',
    age: 21,
    pos: 'Lateral Direito',
    posShort: 'LD',
    foot: 'Destro',
    height: '1,72 m',
    weight: '68 kg',
    nats: [{
      code: 'br'
    }],
    contract: '31/12/2026',
    photo: pic('wesley'),
    monitoring: true,
    rating: 4
  }, {
    id: 'ayrton',
    nick: 'Ayrton Lucas',
    full: 'Ayrton Lucas Dantas de Medeiros',
    club: 'CR Flamengo',
    crest: crest.fla,
    birth: '19/06/1997',
    age: 27,
    pos: 'Lateral Esquerdo',
    posShort: 'LE',
    foot: 'Esquerdo',
    height: '1,80 m',
    weight: '76 kg',
    nats: [{
      code: 'br'
    }],
    contract: '31/12/2026',
    photo: pic('ayrton'),
    monitoring: false,
    rating: 3
  }, {
    id: 'estevao',
    nick: 'Estêvão',
    full: 'Estêvão Willian Almeida de Oliveira Gonçalves',
    club: 'Palmeiras',
    crest: crest.pal,
    birth: '24/04/2007',
    age: 17,
    pos: 'Ponta Direita',
    posShort: 'PD',
    foot: 'Esquerdo',
    height: '1,76 m',
    weight: '69 kg',
    nats: [{
      code: 'br'
    }],
    contract: '30/06/2026',
    photo: pic('estevao'),
    monitoring: false,
    rating: 5
  }, {
    id: 'endrick',
    nick: 'Endrick',
    full: 'Endrick Felipe Moreira de Sousa',
    club: 'Real Madrid',
    crest: crest.rma,
    birth: '21/07/2006',
    age: 18,
    pos: 'Atacante',
    posShort: 'ATA',
    foot: 'Destro',
    height: '1,74 m',
    weight: '70 kg',
    nats: [{
      code: 'br'
    }],
    contract: '30/06/2030',
    photo: pic('endrick'),
    monitoring: false,
    rating: 4
  }];
  const performance = [['2023/2024', 'La Liga', 'Real Madrid', crest.rma, "2.450'", 28, 26, 2, 12, 4, 0, 0], ['2023/2024', 'Champions League', 'Real Madrid', crest.rma, "810'", 9, 9, 0, 5, 1, 0, 0], ['2022/2023', 'La Liga', 'Real Madrid', crest.rma, "2.830'", 33, 32, 1, 10, 10, 1, 1], ['2022/2023', 'Champions League', 'Real Madrid', crest.rma, "975'", 12, 11, 1, 7, 2, 0, 0], ['2022/2023', 'Copa del Rey', 'Real Madrid', crest.rma, "450'", 5, 4, 1, 3, 1, 0, 0]];
  const matches = [['21/04/24', 'La Liga', 'Real Madrid', crest.rma, '3:2', 'Barcelona', crest.bar, "90'", true, false, 1, 1, 0, 0], ['17/04/24', 'Champions', 'Man City', crest.mci, '1:1', 'Real Madrid', crest.rma, "102'", true, false, 0, 0, 0, 0], ['13/04/24', 'La Liga', 'Mallorca', crest.pal, '0:1', 'Real Madrid', crest.rma, "27'", false, true, 0, 0, 0, 0], ['09/04/24', 'Champions', 'Real Madrid', crest.rma, '3:3', 'Man City', crest.mci, "86'", true, false, 0, 0, 0, 0], ['31/03/24', 'La Liga', 'Real Madrid', crest.rma, '2:0', 'A. Bilbao', crest.bar, "90'", true, false, 0, 0, 0, 0]];
  const competitions = [[crest.fla, 'Campeonato Carioca 2024', 'FERJ', 'br', 'Brasil', 'Regional', 'Profissional', 12, '17/01/24', '07/04/24', 'in_progress', 'Em andamento'], [crest.cbf, 'Brasileirão Série A', 'CBF', 'br', 'Brasil', 'Nacional', 'Profissional', 20, '13/04/24', '08/12/24', 'in_progress', 'Em andamento'], [crest.fla, 'Copa Rio 2023', 'FERJ', 'br', 'Brasil', 'Regional', 'Profissional', 24, '16/08/23', '11/10/23', 'completed', 'Concluída'], [crest.cbf, 'Copa do Brasil', 'CBF', 'br', 'Brasil', 'Nacional', 'Profissional', 92, '21/02/24', '10/11/24', 'in_progress', 'Em andamento'], [crest.fpf, 'Paulistão 2024', 'FPF', 'br', 'Brasil', 'Regional', 'Profissional', 16, '20/01/24', '07/04/24', 'completed', 'Concluída'], [crest.cbf, 'Brasileirão Série B', 'CBF', 'br', 'Brasil', 'Nacional', 'Profissional', 20, '19/04/24', '24/11/24', 'in_progress', 'Em andamento'], [crest.cbf, 'Brasileirão Sub-20', 'CBF', 'br', 'Brasil', 'Nacional', 'Sub-20', 20, '03/04/24', '28/08/24', 'in_progress', 'Em andamento'], [crest.cbf, 'Brasileirão Série D', 'CBF', 'br', 'Brasil', 'Nacional', 'Profissional', 64, '28/04/24', '29/09/24', 'not_started', 'Não iniciada']];
  const conversations = [{
    id: 'fla',
    name: 'CR Flamengo',
    full: 'Diretoria de Futebol',
    preview: 'Podemos conversar sobre o Wesley?',
    date: '14:02',
    unread: 2,
    avatar: pic('fla2'),
    shield: crest.fla
  }, {
    id: 'rma',
    name: 'Real Madrid',
    full: 'Scouting Dept.',
    preview: 'Enviamos o relatório do Endrick.',
    date: 'Ter',
    unread: 0,
    avatar: pic('rma2'),
    shield: crest.rma
  }, {
    id: 'roc',
    name: 'ROC NATION',
    full: 'Agência',
    preview: 'O atleta tem interesse.',
    date: 'Seg',
    unread: 0,
    avatar: pic('roc'),
    shield: null
  }, {
    id: 'pal',
    name: 'Palmeiras',
    full: 'Base',
    preview: 'Estêvão renovou até 2026.',
    date: '09/04',
    unread: 0,
    avatar: pic('pal2'),
    shield: crest.pal
  }];
  const messages = [{
    type: 'received',
    sender: 'CR Flamengo',
    text: 'Bom dia! Podemos conversar sobre o Wesley?',
    time: '14:02'
  }, {
    type: 'sent',
    text: 'Bom dia. Claro — temos interesse em acompanhar.',
    time: '14:04'
  }, {
    type: 'received',
    sender: 'CR Flamengo',
    text: 'Segue o perfil do atleta para análise.',
    time: '14:05',
    card: 'wesley'
  }, {
    type: 'sent',
    text: 'Recebido. Envio nossa proposta de observação hoje à tarde.',
    time: '14:09'
  }];
  const modules = [{
    label: 'Meu Feed',
    color: 'var(--iconBlue)',
    key: 'feed'
  }, {
    label: 'Busca de Atletas',
    color: 'var(--iconGreen)',
    key: 'athletes'
  }, {
    label: 'Clubes',
    color: 'var(--iconRed)',
    key: 'clubs'
  }, {
    label: 'Competições',
    color: 'var(--iconYellow)',
    key: 'competitions'
  }, {
    label: 'Análise de Mercado',
    color: '#9b51e0',
    key: 'analysis'
  }, {
    label: 'Mercado de Transferências',
    color: 'var(--iconGreen)',
    key: 'transfers'
  }, {
    label: 'Agências',
    color: '#4f4f4f',
    key: 'agencies'
  }];
  return {
    crest,
    athletes,
    performance,
    matches,
    competitions,
    conversations,
    messages,
    modules
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/footlink-scout/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.CountBadge = __ds_scope.CountBadge;

__ds_ns.NotificationDot = __ds_scope.NotificationDot;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Flag = __ds_scope.Flag;

__ds_ns.NationalitiesRow = __ds_scope.NationalitiesRow;

__ds_ns.CountryRow = __ds_scope.CountryRow;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.AthleteCell = __ds_scope.AthleteCell;

__ds_ns.ClubCell = __ds_scope.ClubCell;

__ds_ns.AthleteCard = __ds_scope.AthleteCard;

__ds_ns.KanbanColumn = __ds_scope.KanbanColumn;

__ds_ns.AddColumnButton = __ds_scope.AddColumnButton;

__ds_ns.MonitoringButton = __ds_scope.MonitoringButton;

__ds_ns.ChatMessage = __ds_scope.ChatMessage;

__ds_ns.DatePill = __ds_scope.DatePill;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedToggle = __ds_scope.SegmentedToggle;

__ds_ns.GenderSwitcher = __ds_scope.GenderSwitcher;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.AppBar = __ds_scope.AppBar;

__ds_ns.NavDrawer = __ds_scope.NavDrawer;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TabButtons = __ds_scope.TabButtons;

})();
