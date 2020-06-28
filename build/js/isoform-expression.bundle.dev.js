var IsoformExpression = (function (exports) {
  'use strict';

  var xhtml = "http://www.w3.org/1999/xhtml";

  var namespaces = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: xhtml,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  function namespace(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
  }

  function creatorInherit(name) {
    return function() {
      var document = this.ownerDocument,
          uri = this.namespaceURI;
      return uri === xhtml && document.documentElement.namespaceURI === xhtml
          ? document.createElement(name)
          : document.createElementNS(uri, name);
    };
  }

  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }

  function creator(name) {
    var fullname = namespace(name);
    return (fullname.local
        ? creatorFixed
        : creatorInherit)(fullname);
  }

  function none() {}

  function selector(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }

  function selection_select(select) {
    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function empty() {
    return [];
  }

  function selectorAll(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }

  function selection_selectAll(select) {
    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }

    return new Selection(subgroups, parents);
  }

  var matcher = function(selector) {
    return function() {
      return this.matches(selector);
    };
  };

  if (typeof document !== "undefined") {
    var element = document.documentElement;
    if (!element.matches) {
      var vendorMatches = element.webkitMatchesSelector
          || element.msMatchesSelector
          || element.mozMatchesSelector
          || element.oMatchesSelector;
      matcher = function(selector) {
        return function() {
          return vendorMatches.call(this, selector);
        };
      };
    }
  }

  var matcher$1 = matcher;

  function selection_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function sparse(update) {
    return new Array(update.length);
  }

  function selection_enter() {
    return new Selection(this._enter || this._groups.map(sparse), this._parents);
  }

  function EnterNode(parent, datum) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum;
  }

  EnterNode.prototype = {
    constructor: EnterNode,
    appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
    insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
    querySelector: function(selector) { return this._parent.querySelector(selector); },
    querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
  };

  function constant(x) {
    return function() {
      return x;
    };
  }

  var keyPrefix = "$"; // Protect against keys like “__proto__”.

  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0,
        node,
        groupLength = group.length,
        dataLength = data.length;

    // Put any non-null nodes that fit into update.
    // Put any null nodes into enter.
    // Put any remaining data into enter.
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Put any non-null nodes that don’t fit into exit.
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }

  function bindKey(parent, group, enter, update, exit, data, key) {
    var i,
        node,
        nodeByKeyValue = {},
        groupLength = group.length,
        dataLength = data.length,
        keyValues = new Array(groupLength),
        keyValue;

    // Compute the key for each node.
    // If multiple nodes have the same key, the duplicates are added to exit.
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
        if (keyValue in nodeByKeyValue) {
          exit[i] = node;
        } else {
          nodeByKeyValue[keyValue] = node;
        }
      }
    }

    // Compute the key for each datum.
    // If there a node associated with this key, join and add it to update.
    // If there is not (or the key is a duplicate), add it to enter.
    for (i = 0; i < dataLength; ++i) {
      keyValue = keyPrefix + key.call(parent, data[i], i, data);
      if (node = nodeByKeyValue[keyValue]) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue[keyValue] = null;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Add any remaining nodes that were not bound to data to exit.
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
        exit[i] = node;
      }
    }
  }

  function selection_data(value, key) {
    if (!value) {
      data = new Array(this.size()), j = -1;
      this.each(function(d) { data[++j] = d; });
      return data;
    }

    var bind = key ? bindKey : bindIndex,
        parents = this._parents,
        groups = this._groups;

    if (typeof value !== "function") value = constant(value);

    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j],
          group = groups[j],
          groupLength = group.length,
          data = value.call(parent, parent && parent.__data__, j, parents),
          dataLength = data.length,
          enterGroup = enter[j] = new Array(dataLength),
          updateGroup = update[j] = new Array(dataLength),
          exitGroup = exit[j] = new Array(groupLength);

      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

      // Now connect the enter nodes to their following update node, such that
      // appendChild can insert the materialized enter node before this node,
      // rather than at the end of the parent node.
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength);
          previous._next = next || null;
        }
      }
    }

    update = new Selection(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }

  function selection_exit() {
    return new Selection(this._exit || this._groups.map(sparse), this._parents);
  }

  function selection_merge(selection$$1) {

    for (var groups0 = this._groups, groups1 = selection$$1._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Selection(merges, this._parents);
  }

  function selection_order() {

    for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
        if (node = group[i]) {
          if (next && next !== node.nextSibling) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }

    return this;
  }

  function selection_sort(compare) {
    if (!compare) compare = ascending;

    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }

    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }

    return new Selection(sortgroups, this._parents).order();
  }

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function selection_call() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }

  function selection_nodes() {
    var nodes = new Array(this.size()), i = -1;
    this.each(function() { nodes[++i] = this; });
    return nodes;
  }

  function selection_node() {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }

    return null;
  }

  function selection_size() {
    var size = 0;
    this.each(function() { ++size; });
    return size;
  }

  function selection_empty() {
    return !this.node();
  }

  function selection_each(callback) {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }

    return this;
  }

  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }

  function attrConstantNS(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }

  function attrFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }

  function attrFunctionNS(fullname, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }

  function selection_attr(name, value) {
    var fullname = namespace(name);

    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local
          ? node.getAttributeNS(fullname.space, fullname.local)
          : node.getAttribute(fullname);
    }

    return this.each((value == null
        ? (fullname.local ? attrRemoveNS : attrRemove) : (typeof value === "function"
        ? (fullname.local ? attrFunctionNS : attrFunction)
        : (fullname.local ? attrConstantNS : attrConstant)))(fullname, value));
  }

  function defaultView(node) {
    return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
        || (node.document && node) // node is a Window
        || node.defaultView; // node is a Document
  }

  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }

  function styleFunction(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }

  function selection_style(name, value, priority) {
    return arguments.length > 1
        ? this.each((value == null
              ? styleRemove : typeof value === "function"
              ? styleFunction
              : styleConstant)(name, value, priority == null ? "" : priority))
        : styleValue(this.node(), name);
  }

  function styleValue(node, name) {
    return node.style.getPropertyValue(name)
        || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
  }

  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }

  function propertyConstant(name, value) {
    return function() {
      this[name] = value;
    };
  }

  function propertyFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }

  function selection_property(name, value) {
    return arguments.length > 1
        ? this.each((value == null
            ? propertyRemove : typeof value === "function"
            ? propertyFunction
            : propertyConstant)(name, value))
        : this.node()[name];
  }

  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }

  function classList(node) {
    return node.classList || new ClassList(node);
  }

  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }

  ClassList.prototype = {
    add: function(name) {
      var i = this._names.indexOf(name);
      if (i < 0) {
        this._names.push(name);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    remove: function(name) {
      var i = this._names.indexOf(name);
      if (i >= 0) {
        this._names.splice(i, 1);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    contains: function(name) {
      return this._names.indexOf(name) >= 0;
    }
  };

  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }

  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }

  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }

  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }

  function classedFunction(names, value) {
    return function() {
      (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }

  function selection_classed(name, value) {
    var names = classArray(name + "");

    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }

    return this.each((typeof value === "function"
        ? classedFunction : value
        ? classedTrue
        : classedFalse)(names, value));
  }

  function textRemove() {
    this.textContent = "";
  }

  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }

  function selection_text(value) {
    return arguments.length
        ? this.each(value == null
            ? textRemove : (typeof value === "function"
            ? textFunction
            : textConstant)(value))
        : this.node().textContent;
  }

  function htmlRemove() {
    this.innerHTML = "";
  }

  function htmlConstant(value) {
    return function() {
      this.innerHTML = value;
    };
  }

  function htmlFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }

  function selection_html(value) {
    return arguments.length
        ? this.each(value == null
            ? htmlRemove : (typeof value === "function"
            ? htmlFunction
            : htmlConstant)(value))
        : this.node().innerHTML;
  }

  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }

  function selection_raise() {
    return this.each(raise);
  }

  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }

  function selection_lower() {
    return this.each(lower);
  }

  function selection_append(name) {
    var create = typeof name === "function" ? name : creator(name);
    return this.select(function() {
      return this.appendChild(create.apply(this, arguments));
    });
  }

  function constantNull() {
    return null;
  }

  function selection_insert(name, before) {
    var create = typeof name === "function" ? name : creator(name),
        select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
    return this.select(function() {
      return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }

  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }

  function selection_remove() {
    return this.each(remove);
  }

  function selection_cloneShallow() {
    return this.parentNode.insertBefore(this.cloneNode(false), this.nextSibling);
  }

  function selection_cloneDeep() {
    return this.parentNode.insertBefore(this.cloneNode(true), this.nextSibling);
  }

  function selection_clone(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }

  function selection_datum(value) {
    return arguments.length
        ? this.property("__data__", value)
        : this.node().__data__;
  }

  var filterEvents = {};

  var event = null;

  if (typeof document !== "undefined") {
    var element$1 = document.documentElement;
    if (!("onmouseenter" in element$1)) {
      filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
    }
  }

  function filterContextListener(listener, index, group) {
    listener = contextListener(listener, index, group);
    return function(event) {
      var related = event.relatedTarget;
      if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
        listener.call(this, event);
      }
    };
  }

  function contextListener(listener, index, group) {
    return function(event1) {
      var event0 = event; // Events can be reentrant (e.g., focus).
      event = event1;
      try {
        listener.call(this, this.__data__, index, group);
      } finally {
        event = event0;
      }
    };
  }

  function parseTypenames(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return {type: t, name: name};
    });
  }

  function onRemove(typename) {
    return function() {
      var on = this.__on;
      if (!on) return;
      for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
        if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
        } else {
          on[++i] = o;
        }
      }
      if (++i) on.length = i;
      else delete this.__on;
    };
  }

  function onAdd(typename, value, capture) {
    var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
    return function(d, i, group) {
      var on = this.__on, o, listener = wrap(value, i, group);
      if (on) for (var j = 0, m = on.length; j < m; ++j) {
        if ((o = on[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
          this.addEventListener(o.type, o.listener = listener, o.capture = capture);
          o.value = value;
          return;
        }
      }
      this.addEventListener(typename.type, listener, capture);
      o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
      if (!on) this.__on = [o];
      else on.push(o);
    };
  }

  function selection_on(typename, value, capture) {
    var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;

    if (arguments.length < 2) {
      var on = this.node().__on;
      if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
        for (i = 0, o = on[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }

    on = value ? onAdd : onRemove;
    if (capture == null) capture = false;
    for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
    return this;
  }

  function dispatchEvent(node, type, params) {
    var window = defaultView(node),
        event = window.CustomEvent;

    if (typeof event === "function") {
      event = new event(type, params);
    } else {
      event = window.document.createEvent("Event");
      if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type, false, false);
    }

    node.dispatchEvent(event);
  }

  function dispatchConstant(type, params) {
    return function() {
      return dispatchEvent(this, type, params);
    };
  }

  function dispatchFunction(type, params) {
    return function() {
      return dispatchEvent(this, type, params.apply(this, arguments));
    };
  }

  function selection_dispatch(type, params) {
    return this.each((typeof params === "function"
        ? dispatchFunction
        : dispatchConstant)(type, params));
  }

  var root = [null];

  function Selection(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }

  function selection() {
    return new Selection([[document.documentElement]], root);
  }

  Selection.prototype = selection.prototype = {
    constructor: Selection,
    select: selection_select,
    selectAll: selection_selectAll,
    filter: selection_filter,
    data: selection_data,
    enter: selection_enter,
    exit: selection_exit,
    merge: selection_merge,
    order: selection_order,
    sort: selection_sort,
    call: selection_call,
    nodes: selection_nodes,
    node: selection_node,
    size: selection_size,
    empty: selection_empty,
    each: selection_each,
    attr: selection_attr,
    style: selection_style,
    property: selection_property,
    classed: selection_classed,
    text: selection_text,
    html: selection_html,
    raise: selection_raise,
    lower: selection_lower,
    append: selection_append,
    insert: selection_insert,
    remove: selection_remove,
    clone: selection_clone,
    datum: selection_datum,
    on: selection_on,
    dispatch: selection_dispatch
  };

  function select(selector) {
    return typeof selector === "string"
        ? new Selection([[document.querySelector(selector)]], [document.documentElement])
        : new Selection([[selector]], root);
  }

  function selectAll(selector) {
    return typeof selector === "string"
        ? new Selection([document.querySelectorAll(selector)], [document.documentElement])
        : new Selection([selector == null ? [] : selector], root);
  }

  var EOL = {},
      EOF = {},
      QUOTE = 34,
      NEWLINE = 10,
      RETURN = 13;

  function objectConverter(columns) {
    return new Function("d", "return {" + columns.map(function(name, i) {
      return JSON.stringify(name) + ": d[" + i + "]";
    }).join(",") + "}");
  }

  function customConverter(columns, f) {
    var object = objectConverter(columns);
    return function(row, i) {
      return f(object(row), i, columns);
    };
  }

  // Compute unique columns in order of discovery.
  function inferColumns(rows) {
    var columnSet = Object.create(null),
        columns = [];

    rows.forEach(function(row) {
      for (var column in row) {
        if (!(column in columnSet)) {
          columns.push(columnSet[column] = column);
        }
      }
    });

    return columns;
  }

  function dsv(delimiter) {
    var reFormat = new RegExp("[\"" + delimiter + "\n\r]"),
        DELIMITER = delimiter.charCodeAt(0);

    function parse(text, f) {
      var convert, columns, rows = parseRows(text, function(row, i) {
        if (convert) return convert(row, i - 1);
        columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
      });
      rows.columns = columns || [];
      return rows;
    }

    function parseRows(text, f) {
      var rows = [], // output rows
          N = text.length,
          I = 0, // current character index
          n = 0, // current line number
          t, // current token
          eof = N <= 0, // current token followed by EOF?
          eol = false; // current token followed by EOL?

      // Strip the trailing newline.
      if (text.charCodeAt(N - 1) === NEWLINE) --N;
      if (text.charCodeAt(N - 1) === RETURN) --N;

      function token() {
        if (eof) return EOF;
        if (eol) return eol = false, EOL;

        // Unescape quotes.
        var i, j = I, c;
        if (text.charCodeAt(j) === QUOTE) {
          while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
          if ((i = I) >= N) eof = true;
          else if ((c = text.charCodeAt(I++)) === NEWLINE) eol = true;
          else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
          return text.slice(j + 1, i - 1).replace(/""/g, "\"");
        }

        // Find next delimiter or newline.
        while (I < N) {
          if ((c = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
          else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
          else if (c !== DELIMITER) continue;
          return text.slice(j, i);
        }

        // Return last token before EOF.
        return eof = true, text.slice(j, N);
      }

      while ((t = token()) !== EOF) {
        var row = [];
        while (t !== EOL && t !== EOF) row.push(t), t = token();
        if (f && (row = f(row, n++)) == null) continue;
        rows.push(row);
      }

      return rows;
    }

    function format(rows, columns) {
      if (columns == null) columns = inferColumns(rows);
      return [columns.map(formatValue).join(delimiter)].concat(rows.map(function(row) {
        return columns.map(function(column) {
          return formatValue(row[column]);
        }).join(delimiter);
      })).join("\n");
    }

    function formatRows(rows) {
      return rows.map(formatRow).join("\n");
    }

    function formatRow(row) {
      return row.map(formatValue).join(delimiter);
    }

    function formatValue(text) {
      return text == null ? ""
          : reFormat.test(text += "") ? "\"" + text.replace(/"/g, "\"\"") + "\""
          : text;
    }

    return {
      parse: parse,
      parseRows: parseRows,
      format: format,
      formatRows: formatRows
    };
  }

  var csv = dsv(",");

  var csvParse = csv.parse;
  var csvParseRows = csv.parseRows;
  var csvFormat = csv.format;
  var csvFormatRows = csv.formatRows;

  var tsv = dsv("\t");

  var tsvParse = tsv.parse;
  var tsvParseRows = tsv.parseRows;
  var tsvFormat = tsv.format;
  var tsvFormatRows = tsv.formatRows;

  function responseJson(response) {
    if (!response.ok) throw new Error(response.status + " " + response.statusText);
    return response.json();
  }

  function json(input, init) {
    return fetch(input, init).then(responseJson);
  }

  function ascending$1(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function bisector(compare) {
    if (compare.length === 1) compare = ascendingComparator(compare);
    return {
      left: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) < 0) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      right: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) > 0) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      }
    };
  }

  function ascendingComparator(f) {
    return function(d, x) {
      return ascending$1(f(d), x);
    };
  }

  var ascendingBisect = bisector(ascending$1);
  var bisectRight = ascendingBisect.right;

  function sequence(start, stop, step) {
    start = +start, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;

    var i = -1,
        n = Math.max(0, Math.ceil((stop - start) / step)) | 0,
        range = new Array(n);

    while (++i < n) {
      range[i] = start + i * step;
    }

    return range;
  }

  var e10 = Math.sqrt(50),
      e5 = Math.sqrt(10),
      e2 = Math.sqrt(2);

  function ticks(start, stop, count) {
    var reverse,
        i = -1,
        n,
        ticks,
        step;

    stop = +stop, start = +start, count = +count;
    if (start === stop && count > 0) return [start];
    if (reverse = stop < start) n = start, start = stop, stop = n;
    if ((step = tickIncrement(start, stop, count)) === 0 || !isFinite(step)) return [];

    if (step > 0) {
      start = Math.ceil(start / step);
      stop = Math.floor(stop / step);
      ticks = new Array(n = Math.ceil(stop - start + 1));
      while (++i < n) ticks[i] = (start + i) * step;
    } else {
      start = Math.floor(start * step);
      stop = Math.ceil(stop * step);
      ticks = new Array(n = Math.ceil(start - stop + 1));
      while (++i < n) ticks[i] = (start - i) / step;
    }

    if (reverse) ticks.reverse();

    return ticks;
  }

  function tickIncrement(start, stop, count) {
    var step = (stop - start) / Math.max(0, count),
        power = Math.floor(Math.log(step) / Math.LN10),
        error = step / Math.pow(10, power);
    return power >= 0
        ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power)
        : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
  }

  function tickStep(start, stop, count) {
    var step0 = Math.abs(stop - start) / Math.max(0, count),
        step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
        error = step0 / step1;
    if (error >= e10) step1 *= 10;
    else if (error >= e5) step1 *= 5;
    else if (error >= e2) step1 *= 2;
    return stop < start ? -step1 : step1;
  }

  function max(values, valueof) {
    var n = values.length,
        i = -1,
        value,
        max;

    if (valueof == null) {
      while (++i < n) { // Find the first comparable value.
        if ((value = values[i]) != null && value >= value) {
          max = value;
          while (++i < n) { // Compare the remaining values.
            if ((value = values[i]) != null && value > max) {
              max = value;
            }
          }
        }
      }
    }

    else {
      while (++i < n) { // Find the first comparable value.
        if ((value = valueof(values[i], i, values)) != null && value >= value) {
          max = value;
          while (++i < n) { // Compare the remaining values.
            if ((value = valueof(values[i], i, values)) != null && value > max) {
              max = value;
            }
          }
        }
      }
    }

    return max;
  }

  function min(values, valueof) {
    var n = values.length,
        i = -1,
        value,
        min;

    if (valueof == null) {
      while (++i < n) { // Find the first comparable value.
        if ((value = values[i]) != null && value >= value) {
          min = value;
          while (++i < n) { // Compare the remaining values.
            if ((value = values[i]) != null && min > value) {
              min = value;
            }
          }
        }
      }
    }

    else {
      while (++i < n) { // Find the first comparable value.
        if ((value = valueof(values[i], i, values)) != null && value >= value) {
          min = value;
          while (++i < n) { // Compare the remaining values.
            if ((value = valueof(values[i], i, values)) != null && min > value) {
              min = value;
            }
          }
        }
      }
    }

    return min;
  }

  function sum(values, valueof) {
    var n = values.length,
        i = -1,
        value,
        sum = 0;

    if (valueof == null) {
      while (++i < n) {
        if (value = +values[i]) sum += value; // Note: zero and null are equivalent.
      }
    }

    else {
      while (++i < n) {
        if (value = +valueof(values[i], i, values)) sum += value;
      }
    }

    return sum;
  }

  var prefix = "$";

  function Map() {}

  Map.prototype = map$1.prototype = {
    constructor: Map,
    has: function(key) {
      return (prefix + key) in this;
    },
    get: function(key) {
      return this[prefix + key];
    },
    set: function(key, value) {
      this[prefix + key] = value;
      return this;
    },
    remove: function(key) {
      var property = prefix + key;
      return property in this && delete this[property];
    },
    clear: function() {
      for (var property in this) if (property[0] === prefix) delete this[property];
    },
    keys: function() {
      var keys = [];
      for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));
      return keys;
    },
    values: function() {
      var values = [];
      for (var property in this) if (property[0] === prefix) values.push(this[property]);
      return values;
    },
    entries: function() {
      var entries = [];
      for (var property in this) if (property[0] === prefix) entries.push({key: property.slice(1), value: this[property]});
      return entries;
    },
    size: function() {
      var size = 0;
      for (var property in this) if (property[0] === prefix) ++size;
      return size;
    },
    empty: function() {
      for (var property in this) if (property[0] === prefix) return false;
      return true;
    },
    each: function(f) {
      for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
    }
  };

  function map$1(object, f) {
    var map = new Map;

    // Copy constructor.
    if (object instanceof Map) object.each(function(value, key) { map.set(key, value); });

    // Index array by numeric index or specified key function.
    else if (Array.isArray(object)) {
      var i = -1,
          n = object.length,
          o;

      if (f == null) while (++i < n) map.set(i, object[i]);
      else while (++i < n) map.set(f(o = object[i], i, object), o);
    }

    // Convert object to map.
    else if (object) for (var key in object) map.set(key, object[key]);

    return map;
  }

  function nest() {
    var keys = [],
        sortKeys = [],
        sortValues,
        rollup,
        nest;

    function apply(array, depth, createResult, setResult) {
      if (depth >= keys.length) {
        if (sortValues != null) array.sort(sortValues);
        return rollup != null ? rollup(array) : array;
      }

      var i = -1,
          n = array.length,
          key = keys[depth++],
          keyValue,
          value,
          valuesByKey = map$1(),
          values,
          result = createResult();

      while (++i < n) {
        if (values = valuesByKey.get(keyValue = key(value = array[i]) + "")) {
          values.push(value);
        } else {
          valuesByKey.set(keyValue, [value]);
        }
      }

      valuesByKey.each(function(values, key) {
        setResult(result, key, apply(values, depth, createResult, setResult));
      });

      return result;
    }

    function entries(map, depth) {
      if (++depth > keys.length) return map;
      var array, sortKey = sortKeys[depth - 1];
      if (rollup != null && depth >= keys.length) array = map.entries();
      else array = [], map.each(function(v, k) { array.push({key: k, values: entries(v, depth)}); });
      return sortKey != null ? array.sort(function(a, b) { return sortKey(a.key, b.key); }) : array;
    }

    return nest = {
      object: function(array) { return apply(array, 0, createObject, setObject); },
      map: function(array) { return apply(array, 0, createMap, setMap); },
      entries: function(array) { return entries(apply(array, 0, createMap, setMap), 0); },
      key: function(d) { keys.push(d); return nest; },
      sortKeys: function(order) { sortKeys[keys.length - 1] = order; return nest; },
      sortValues: function(order) { sortValues = order; return nest; },
      rollup: function(f) { rollup = f; return nest; }
    };
  }

  function createObject() {
    return {};
  }

  function setObject(object, key, value) {
    object[key] = value;
  }

  function createMap() {
    return map$1();
  }

  function setMap(map, key, value) {
    map.set(key, value);
  }

  function Set() {}

  var proto = map$1.prototype;

  Set.prototype = set.prototype = {
    constructor: Set,
    has: proto.has,
    add: function(value) {
      value += "";
      this[prefix + value] = value;
      return this;
    },
    remove: proto.remove,
    clear: proto.clear,
    values: proto.keys,
    size: proto.size,
    empty: proto.empty,
    each: proto.each
  };

  function set(object, f) {
    var set = new Set;

    // Copy constructor.
    if (object instanceof Set) object.each(function(value) { set.add(value); });

    // Otherwise, assume it’s an array.
    else if (object) {
      var i = -1, n = object.length;
      if (f == null) while (++i < n) set.add(object[i]);
      else while (++i < n) set.add(f(object[i], i, object));
    }

    return set;
  }

  var array$1 = Array.prototype;

  var map$2 = array$1.map;
  var slice$1 = array$1.slice;

  var implicit = {name: "implicit"};

  function ordinal(range) {
    var index = map$1(),
        domain = [],
        unknown = implicit;

    range = range == null ? [] : slice$1.call(range);

    function scale(d) {
      var key = d + "", i = index.get(key);
      if (!i) {
        if (unknown !== implicit) return unknown;
        index.set(key, i = domain.push(d));
      }
      return range[(i - 1) % range.length];
    }

    scale.domain = function(_) {
      if (!arguments.length) return domain.slice();
      domain = [], index = map$1();
      var i = -1, n = _.length, d, key;
      while (++i < n) if (!index.has(key = (d = _[i]) + "")) index.set(key, domain.push(d));
      return scale;
    };

    scale.range = function(_) {
      return arguments.length ? (range = slice$1.call(_), scale) : range.slice();
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    scale.copy = function() {
      return ordinal()
          .domain(domain)
          .range(range)
          .unknown(unknown);
    };

    return scale;
  }

  function band() {
    var scale = ordinal().unknown(undefined),
        domain = scale.domain,
        ordinalRange = scale.range,
        range$$1 = [0, 1],
        step,
        bandwidth,
        round = false,
        paddingInner = 0,
        paddingOuter = 0,
        align = 0.5;

    delete scale.unknown;

    function rescale() {
      var n = domain().length,
          reverse = range$$1[1] < range$$1[0],
          start = range$$1[reverse - 0],
          stop = range$$1[1 - reverse];
      step = (stop - start) / Math.max(1, n - paddingInner + paddingOuter * 2);
      if (round) step = Math.floor(step);
      start += (stop - start - step * (n - paddingInner)) * align;
      bandwidth = step * (1 - paddingInner);
      if (round) start = Math.round(start), bandwidth = Math.round(bandwidth);
      var values = sequence(n).map(function(i) { return start + step * i; });
      return ordinalRange(reverse ? values.reverse() : values);
    }

    scale.domain = function(_) {
      return arguments.length ? (domain(_), rescale()) : domain();
    };

    scale.range = function(_) {
      return arguments.length ? (range$$1 = [+_[0], +_[1]], rescale()) : range$$1.slice();
    };

    scale.rangeRound = function(_) {
      return range$$1 = [+_[0], +_[1]], round = true, rescale();
    };

    scale.bandwidth = function() {
      return bandwidth;
    };

    scale.step = function() {
      return step;
    };

    scale.round = function(_) {
      return arguments.length ? (round = !!_, rescale()) : round;
    };

    scale.padding = function(_) {
      return arguments.length ? (paddingInner = paddingOuter = Math.max(0, Math.min(1, _)), rescale()) : paddingInner;
    };

    scale.paddingInner = function(_) {
      return arguments.length ? (paddingInner = Math.max(0, Math.min(1, _)), rescale()) : paddingInner;
    };

    scale.paddingOuter = function(_) {
      return arguments.length ? (paddingOuter = Math.max(0, Math.min(1, _)), rescale()) : paddingOuter;
    };

    scale.align = function(_) {
      return arguments.length ? (align = Math.max(0, Math.min(1, _)), rescale()) : align;
    };

    scale.copy = function() {
      return band()
          .domain(domain())
          .range(range$$1)
          .round(round)
          .paddingInner(paddingInner)
          .paddingOuter(paddingOuter)
          .align(align);
    };

    return rescale();
  }

  function define(constructor, factory, prototype) {
    constructor.prototype = factory.prototype = prototype;
    prototype.constructor = constructor;
  }

  function extend(parent, definition) {
    var prototype = Object.create(parent.prototype);
    for (var key in definition) prototype[key] = definition[key];
    return prototype;
  }

  function Color() {}

  var darker = 0.7;
  var brighter = 1 / darker;

  var reI = "\\s*([+-]?\\d+)\\s*",
      reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
      reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
      reHex3 = /^#([0-9a-f]{3})$/,
      reHex6 = /^#([0-9a-f]{6})$/,
      reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
      reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
      reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
      reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
      reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
      reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

  var named = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32
  };

  define(Color, color, {
    displayable: function() {
      return this.rgb().displayable();
    },
    hex: function() {
      return this.rgb().hex();
    },
    toString: function() {
      return this.rgb() + "";
    }
  });

  function color(format) {
    var m;
    format = (format + "").trim().toLowerCase();
    return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), new Rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1)) // #f00
        : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
        : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
        : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
        : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
        : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
        : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
        : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
        : named.hasOwnProperty(format) ? rgbn(named[format])
        : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
        : null;
  }

  function rgbn(n) {
    return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
  }

  function rgba(r, g, b, a) {
    if (a <= 0) r = g = b = NaN;
    return new Rgb(r, g, b, a);
  }

  function rgbConvert(o) {
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Rgb;
    o = o.rgb();
    return new Rgb(o.r, o.g, o.b, o.opacity);
  }

  function rgb(r, g, b, opacity) {
    return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
  }

  function Rgb(r, g, b, opacity) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Rgb, rgb, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    rgb: function() {
      return this;
    },
    displayable: function() {
      return (0 <= this.r && this.r <= 255)
          && (0 <= this.g && this.g <= 255)
          && (0 <= this.b && this.b <= 255)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    hex: function() {
      return "#" + hex(this.r) + hex(this.g) + hex(this.b);
    },
    toString: function() {
      var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
      return (a === 1 ? "rgb(" : "rgba(")
          + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
          + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
          + Math.max(0, Math.min(255, Math.round(this.b) || 0))
          + (a === 1 ? ")" : ", " + a + ")");
    }
  }));

  function hex(value) {
    value = Math.max(0, Math.min(255, Math.round(value) || 0));
    return (value < 16 ? "0" : "") + value.toString(16);
  }

  function hsla(h, s, l, a) {
    if (a <= 0) h = s = l = NaN;
    else if (l <= 0 || l >= 1) h = s = NaN;
    else if (s <= 0) h = NaN;
    return new Hsl(h, s, l, a);
  }

  function hslConvert(o) {
    if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Hsl;
    if (o instanceof Hsl) return o;
    o = o.rgb();
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        min = Math.min(r, g, b),
        max = Math.max(r, g, b),
        h = NaN,
        s = max - min,
        l = (max + min) / 2;
    if (s) {
      if (r === max) h = (g - b) / s + (g < b) * 6;
      else if (g === max) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max + min : 2 - max - min;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return new Hsl(h, s, l, o.opacity);
  }

  function hsl(h, s, l, opacity) {
    return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
  }

  function Hsl(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Hsl, hsl, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = this.h % 360 + (this.h < 0) * 360,
          s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
          l = this.l,
          m2 = l + (l < 0.5 ? l : 1 - l) * s,
          m1 = 2 * l - m2;
      return new Rgb(
        hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
        hsl2rgb(h, m1, m2),
        hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
        this.opacity
      );
    },
    displayable: function() {
      return (0 <= this.s && this.s <= 1 || isNaN(this.s))
          && (0 <= this.l && this.l <= 1)
          && (0 <= this.opacity && this.opacity <= 1);
    }
  }));

  /* From FvD 13.37, CSS Color Module Level 3 */
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60
        : h < 180 ? m2
        : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
        : m1) * 255;
  }

  var deg2rad = Math.PI / 180;
  var rad2deg = 180 / Math.PI;

  // https://beta.observablehq.com/@mbostock/lab-and-rgb
  var K = 18,
      Xn = 0.96422,
      Yn = 1,
      Zn = 0.82521,
      t0 = 4 / 29,
      t1 = 6 / 29,
      t2 = 3 * t1 * t1,
      t3 = t1 * t1 * t1;

  function labConvert(o) {
    if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
    if (o instanceof Hcl) {
      if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
      var h = o.h * deg2rad;
      return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
    }
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = rgb2lrgb(o.r),
        g = rgb2lrgb(o.g),
        b = rgb2lrgb(o.b),
        y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn), x, z;
    if (r === g && g === b) x = z = y; else {
      x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
      z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
    }
    return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
  }

  function lab(l, a, b, opacity) {
    return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
  }

  function Lab(l, a, b, opacity) {
    this.l = +l;
    this.a = +a;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Lab, lab, extend(Color, {
    brighter: function(k) {
      return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    darker: function(k) {
      return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    rgb: function() {
      var y = (this.l + 16) / 116,
          x = isNaN(this.a) ? y : y + this.a / 500,
          z = isNaN(this.b) ? y : y - this.b / 200;
      x = Xn * lab2xyz(x);
      y = Yn * lab2xyz(y);
      z = Zn * lab2xyz(z);
      return new Rgb(
        lrgb2rgb( 3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
        lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
        lrgb2rgb( 0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
        this.opacity
      );
    }
  }));

  function xyz2lab(t) {
    return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }

  function lab2xyz(t) {
    return t > t1 ? t * t * t : t2 * (t - t0);
  }

  function lrgb2rgb(x) {
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  }

  function rgb2lrgb(x) {
    return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  function hclConvert(o) {
    if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
    if (!(o instanceof Lab)) o = labConvert(o);
    if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0, o.l, o.opacity);
    var h = Math.atan2(o.b, o.a) * rad2deg;
    return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
  }

  function hcl(h, c, l, opacity) {
    return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
  }

  function Hcl(h, c, l, opacity) {
    this.h = +h;
    this.c = +c;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Hcl, hcl, extend(Color, {
    brighter: function(k) {
      return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
    },
    darker: function(k) {
      return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
    },
    rgb: function() {
      return labConvert(this).rgb();
    }
  }));

  var A = -0.14861,
      B = +1.78277,
      C = -0.29227,
      D = -0.90649,
      E = +1.97294,
      ED = E * D,
      EB = E * B,
      BC_DA = B * C - D * A;

  function cubehelixConvert(o) {
    if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
        bl = b - l,
        k = (E * (g - l) - C * bl) / D,
        s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
        h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
    return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
  }

  function cubehelix(h, s, l, opacity) {
    return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
  }

  function Cubehelix(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Cubehelix, cubehelix, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
          l = +this.l,
          a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
          cosh = Math.cos(h),
          sinh = Math.sin(h);
      return new Rgb(
        255 * (l + a * (A * cosh + B * sinh)),
        255 * (l + a * (C * cosh + D * sinh)),
        255 * (l + a * (E * cosh)),
        this.opacity
      );
    }
  }));

  function basis(t1, v0, v1, v2, v3) {
    var t2 = t1 * t1, t3 = t2 * t1;
    return ((1 - 3 * t1 + 3 * t2 - t3) * v0
        + (4 - 6 * t2 + 3 * t3) * v1
        + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2
        + t3 * v3) / 6;
  }

  function basis$1(values) {
    var n = values.length - 1;
    return function(t) {
      var i = t <= 0 ? (t = 0) : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n),
          v1 = values[i],
          v2 = values[i + 1],
          v0 = i > 0 ? values[i - 1] : 2 * v1 - v2,
          v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
      return basis((t - i / n) * n, v0, v1, v2, v3);
    };
  }

  function constant$2(x) {
    return function() {
      return x;
    };
  }

  function linear(a, d) {
    return function(t) {
      return a + t * d;
    };
  }

  function exponential(a, b, y) {
    return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
      return Math.pow(a + t * b, y);
    };
  }

  function hue(a, b) {
    var d = b - a;
    return d ? linear(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant$2(isNaN(a) ? b : a);
  }

  function gamma(y) {
    return (y = +y) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y) : constant$2(isNaN(a) ? b : a);
    };
  }

  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant$2(isNaN(a) ? b : a);
  }

  var rgb$1 = (function rgbGamma(y) {
    var color$$1 = gamma(y);

    function rgb$$1(start, end) {
      var r = color$$1((start = rgb(start)).r, (end = rgb(end)).r),
          g = color$$1(start.g, end.g),
          b = color$$1(start.b, end.b),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.r = r(t);
        start.g = g(t);
        start.b = b(t);
        start.opacity = opacity(t);
        return start + "";
      };
    }

    rgb$$1.gamma = rgbGamma;

    return rgb$$1;
  })(1);

  function rgbSpline(spline) {
    return function(colors) {
      var n = colors.length,
          r = new Array(n),
          g = new Array(n),
          b = new Array(n),
          i, color$$1;
      for (i = 0; i < n; ++i) {
        color$$1 = rgb(colors[i]);
        r[i] = color$$1.r || 0;
        g[i] = color$$1.g || 0;
        b[i] = color$$1.b || 0;
      }
      r = spline(r);
      g = spline(g);
      b = spline(b);
      color$$1.opacity = 1;
      return function(t) {
        color$$1.r = r(t);
        color$$1.g = g(t);
        color$$1.b = b(t);
        return color$$1 + "";
      };
    };
  }

  var rgbBasis = rgbSpline(basis$1);

  function array$2(a, b) {
    var nb = b ? b.length : 0,
        na = a ? Math.min(nb, a.length) : 0,
        x = new Array(na),
        c = new Array(nb),
        i;

    for (i = 0; i < na; ++i) x[i] = value(a[i], b[i]);
    for (; i < nb; ++i) c[i] = b[i];

    return function(t) {
      for (i = 0; i < na; ++i) c[i] = x[i](t);
      return c;
    };
  }

  function date(a, b) {
    var d = new Date;
    return a = +a, b -= a, function(t) {
      return d.setTime(a + b * t), d;
    };
  }

  function number$1(a, b) {
    return a = +a, b -= a, function(t) {
      return a + b * t;
    };
  }

  function object(a, b) {
    var i = {},
        c = {},
        k;

    if (a === null || typeof a !== "object") a = {};
    if (b === null || typeof b !== "object") b = {};

    for (k in b) {
      if (k in a) {
        i[k] = value(a[k], b[k]);
      } else {
        c[k] = b[k];
      }
    }

    return function(t) {
      for (k in i) c[k] = i[k](t);
      return c;
    };
  }

  var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
      reB = new RegExp(reA.source, "g");

  function zero(b) {
    return function() {
      return b;
    };
  }

  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }

  function string(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
        am, // current match in a
        bm, // current match in b
        bs, // string preceding current number in b, if any
        i = -1, // index in s
        s = [], // string constants and placeholders
        q = []; // number interpolators

    // Coerce inputs to strings.
    a = a + "", b = b + "";

    // Interpolate pairs of numbers in a & b.
    while ((am = reA.exec(a))
        && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) { // a string precedes the next number in b
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs; // coalesce with previous string
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
        if (s[i]) s[i] += bm; // coalesce with previous string
        else s[++i] = bm;
      } else { // interpolate non-matching numbers
        s[++i] = null;
        q.push({i: i, x: number$1(am, bm)});
      }
      bi = reB.lastIndex;
    }

    // Add remains of b.
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }

    // Special optimization for only a single match.
    // Otherwise, interpolate each of the numbers and rejoin the string.
    return s.length < 2 ? (q[0]
        ? one(q[0].x)
        : zero(b))
        : (b = q.length, function(t) {
            for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
            return s.join("");
          });
  }

  function value(a, b) {
    var t = typeof b, c;
    return b == null || t === "boolean" ? constant$2(b)
        : (t === "number" ? number$1
        : t === "string" ? ((c = color(b)) ? (b = c, rgb$1) : string)
        : b instanceof color ? rgb$1
        : b instanceof Date ? date
        : Array.isArray(b) ? array$2
        : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
        : number$1)(a, b);
  }

  function interpolateRound(a, b) {
    return a = +a, b -= a, function(t) {
      return Math.round(a + b * t);
    };
  }

  var degrees = 180 / Math.PI;

  var identity$1 = {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    skewX: 0,
    scaleX: 1,
    scaleY: 1
  };

  function decompose(a, b, c, d, e, f) {
    var scaleX, scaleY, skewX;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
      translateX: e,
      translateY: f,
      rotate: Math.atan2(b, a) * degrees,
      skewX: Math.atan(skewX) * degrees,
      scaleX: scaleX,
      scaleY: scaleY
    };
  }

  var cssNode,
      cssRoot,
      cssView,
      svgNode;

  function parseCss(value) {
    if (value === "none") return identity$1;
    if (!cssNode) cssNode = document.createElement("DIV"), cssRoot = document.documentElement, cssView = document.defaultView;
    cssNode.style.transform = value;
    value = cssView.getComputedStyle(cssRoot.appendChild(cssNode), null).getPropertyValue("transform");
    cssRoot.removeChild(cssNode);
    value = value.slice(7, -1).split(",");
    return decompose(+value[0], +value[1], +value[2], +value[3], +value[4], +value[5]);
  }

  function parseSvg(value) {
    if (value == null) return identity$1;
    if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svgNode.setAttribute("transform", value);
    if (!(value = svgNode.transform.baseVal.consolidate())) return identity$1;
    value = value.matrix;
    return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
  }

  function interpolateTransform(parse, pxComma, pxParen, degParen) {

    function pop(s) {
      return s.length ? s.pop() + " " : "";
    }

    function translate(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push("translate(", null, pxComma, null, pxParen);
        q.push({i: i - 4, x: number$1(xa, xb)}, {i: i - 2, x: number$1(ya, yb)});
      } else if (xb || yb) {
        s.push("translate(" + xb + pxComma + yb + pxParen);
      }
    }

    function rotate(a, b, s, q) {
      if (a !== b) {
        if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
        q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number$1(a, b)});
      } else if (b) {
        s.push(pop(s) + "rotate(" + b + degParen);
      }
    }

    function skewX(a, b, s, q) {
      if (a !== b) {
        q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number$1(a, b)});
      } else if (b) {
        s.push(pop(s) + "skewX(" + b + degParen);
      }
    }

    function scale(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push(pop(s) + "scale(", null, ",", null, ")");
        q.push({i: i - 4, x: number$1(xa, xb)}, {i: i - 2, x: number$1(ya, yb)});
      } else if (xb !== 1 || yb !== 1) {
        s.push(pop(s) + "scale(" + xb + "," + yb + ")");
      }
    }

    return function(a, b) {
      var s = [], // string constants and placeholders
          q = []; // number interpolators
      a = parse(a), b = parse(b);
      translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
      rotate(a.rotate, b.rotate, s, q);
      skewX(a.skewX, b.skewX, s, q);
      scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
      a = b = null; // gc
      return function(t) {
        var i = -1, n = q.length, o;
        while (++i < n) s[(o = q[i]).i] = o.x(t);
        return s.join("");
      };
    };
  }

  var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
  var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

  var rho = Math.SQRT2;

  function cubehelix$1(hue$$1) {
    return (function cubehelixGamma(y) {
      y = +y;

      function cubehelix$$1(start, end) {
        var h = hue$$1((start = cubehelix(start)).h, (end = cubehelix(end)).h),
            s = nogamma(start.s, end.s),
            l = nogamma(start.l, end.l),
            opacity = nogamma(start.opacity, end.opacity);
        return function(t) {
          start.h = h(t);
          start.s = s(t);
          start.l = l(Math.pow(t, y));
          start.opacity = opacity(t);
          return start + "";
        };
      }

      cubehelix$$1.gamma = cubehelixGamma;

      return cubehelix$$1;
    })(1);
  }

  cubehelix$1(hue);
  var cubehelixLong = cubehelix$1(nogamma);

  function constant$3(x) {
    return function() {
      return x;
    };
  }

  function number$2(x) {
    return +x;
  }

  var unit = [0, 1];

  function deinterpolateLinear(a, b) {
    return (b -= (a = +a))
        ? function(x) { return (x - a) / b; }
        : constant$3(b);
  }

  function deinterpolateClamp(deinterpolate) {
    return function(a, b) {
      var d = deinterpolate(a = +a, b = +b);
      return function(x) { return x <= a ? 0 : x >= b ? 1 : d(x); };
    };
  }

  function reinterpolateClamp(reinterpolate) {
    return function(a, b) {
      var r = reinterpolate(a = +a, b = +b);
      return function(t) { return t <= 0 ? a : t >= 1 ? b : r(t); };
    };
  }

  function bimap(domain, range, deinterpolate, reinterpolate) {
    var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    if (d1 < d0) d0 = deinterpolate(d1, d0), r0 = reinterpolate(r1, r0);
    else d0 = deinterpolate(d0, d1), r0 = reinterpolate(r0, r1);
    return function(x) { return r0(d0(x)); };
  }

  function polymap(domain, range, deinterpolate, reinterpolate) {
    var j = Math.min(domain.length, range.length) - 1,
        d = new Array(j),
        r = new Array(j),
        i = -1;

    // Reverse descending domains.
    if (domain[j] < domain[0]) {
      domain = domain.slice().reverse();
      range = range.slice().reverse();
    }

    while (++i < j) {
      d[i] = deinterpolate(domain[i], domain[i + 1]);
      r[i] = reinterpolate(range[i], range[i + 1]);
    }

    return function(x) {
      var i = bisectRight(domain, x, 1, j) - 1;
      return r[i](d[i](x));
    };
  }

  function copy(source, target) {
    return target
        .domain(source.domain())
        .range(source.range())
        .interpolate(source.interpolate())
        .clamp(source.clamp());
  }

  // deinterpolate(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
  // reinterpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding domain value x in [a,b].
  function continuous(deinterpolate, reinterpolate) {
    var domain = unit,
        range = unit,
        interpolate$$1 = value,
        clamp = false,
        piecewise$$1,
        output,
        input;

    function rescale() {
      piecewise$$1 = Math.min(domain.length, range.length) > 2 ? polymap : bimap;
      output = input = null;
      return scale;
    }

    function scale(x) {
      return (output || (output = piecewise$$1(domain, range, clamp ? deinterpolateClamp(deinterpolate) : deinterpolate, interpolate$$1)))(+x);
    }

    scale.invert = function(y) {
      return (input || (input = piecewise$$1(range, domain, deinterpolateLinear, clamp ? reinterpolateClamp(reinterpolate) : reinterpolate)))(+y);
    };

    scale.domain = function(_) {
      return arguments.length ? (domain = map$2.call(_, number$2), rescale()) : domain.slice();
    };

    scale.range = function(_) {
      return arguments.length ? (range = slice$1.call(_), rescale()) : range.slice();
    };

    scale.rangeRound = function(_) {
      return range = slice$1.call(_), interpolate$$1 = interpolateRound, rescale();
    };

    scale.clamp = function(_) {
      return arguments.length ? (clamp = !!_, rescale()) : clamp;
    };

    scale.interpolate = function(_) {
      return arguments.length ? (interpolate$$1 = _, rescale()) : interpolate$$1;
    };

    return rescale();
  }

  // Computes the decimal coefficient and exponent of the specified number x with
  // significant digits p, where x is positive and p is in [1, 21] or undefined.
  // For example, formatDecimal(1.23) returns ["123", 0].
  function formatDecimal(x, p) {
    if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
    var i, coefficient = x.slice(0, i);

    // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
    // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
    return [
      coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
      +x.slice(i + 1)
    ];
  }

  function exponent(x) {
    return x = formatDecimal(Math.abs(x)), x ? x[1] : NaN;
  }

  function formatGroup(grouping, thousands) {
    return function(value, width) {
      var i = value.length,
          t = [],
          j = 0,
          g = grouping[0],
          length = 0;

      while (i > 0 && g > 0) {
        if (length + g + 1 > width) g = Math.max(1, width - length);
        t.push(value.substring(i -= g, i + g));
        if ((length += g + 1) > width) break;
        g = grouping[j = (j + 1) % grouping.length];
      }

      return t.reverse().join(thousands);
    };
  }

  function formatNumerals(numerals) {
    return function(value) {
      return value.replace(/[0-9]/g, function(i) {
        return numerals[+i];
      });
    };
  }

  // [[fill]align][sign][symbol][0][width][,][.precision][~][type]
  var re = /^(?:(.)?([<>=^]))?([+\-\( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

  function formatSpecifier(specifier) {
    return new FormatSpecifier(specifier);
  }

  formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

  function FormatSpecifier(specifier) {
    if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
    var match;
    this.fill = match[1] || " ";
    this.align = match[2] || ">";
    this.sign = match[3] || "-";
    this.symbol = match[4] || "";
    this.zero = !!match[5];
    this.width = match[6] && +match[6];
    this.comma = !!match[7];
    this.precision = match[8] && +match[8].slice(1);
    this.trim = !!match[9];
    this.type = match[10] || "";
  }

  FormatSpecifier.prototype.toString = function() {
    return this.fill
        + this.align
        + this.sign
        + this.symbol
        + (this.zero ? "0" : "")
        + (this.width == null ? "" : Math.max(1, this.width | 0))
        + (this.comma ? "," : "")
        + (this.precision == null ? "" : "." + Math.max(0, this.precision | 0))
        + (this.trim ? "~" : "")
        + this.type;
  };

  // Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
  function formatTrim(s) {
    out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
      switch (s[i]) {
        case ".": i0 = i1 = i; break;
        case "0": if (i0 === 0) i0 = i; i1 = i; break;
        default: if (i0 > 0) { if (!+s[i]) break out; i0 = 0; } break;
      }
    }
    return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
  }

  var prefixExponent;

  function formatPrefixAuto(x, p) {
    var d = formatDecimal(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1],
        i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
        n = coefficient.length;
    return i === n ? coefficient
        : i > n ? coefficient + new Array(i - n + 1).join("0")
        : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
        : "0." + new Array(1 - i).join("0") + formatDecimal(x, Math.max(0, p + i - 1))[0]; // less than 1y!
  }

  function formatRounded(x, p) {
    var d = formatDecimal(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1];
    return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
        : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
        : coefficient + new Array(exponent - coefficient.length + 2).join("0");
  }

  var formatTypes = {
    "%": function(x, p) { return (x * 100).toFixed(p); },
    "b": function(x) { return Math.round(x).toString(2); },
    "c": function(x) { return x + ""; },
    "d": function(x) { return Math.round(x).toString(10); },
    "e": function(x, p) { return x.toExponential(p); },
    "f": function(x, p) { return x.toFixed(p); },
    "g": function(x, p) { return x.toPrecision(p); },
    "o": function(x) { return Math.round(x).toString(8); },
    "p": function(x, p) { return formatRounded(x * 100, p); },
    "r": formatRounded,
    "s": formatPrefixAuto,
    "X": function(x) { return Math.round(x).toString(16).toUpperCase(); },
    "x": function(x) { return Math.round(x).toString(16); }
  };

  function identity$2(x) {
    return x;
  }

  var prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

  function formatLocale(locale) {
    var group = locale.grouping && locale.thousands ? formatGroup(locale.grouping, locale.thousands) : identity$2,
        currency = locale.currency,
        decimal = locale.decimal,
        numerals = locale.numerals ? formatNumerals(locale.numerals) : identity$2,
        percent = locale.percent || "%";

    function newFormat(specifier) {
      specifier = formatSpecifier(specifier);

      var fill = specifier.fill,
          align = specifier.align,
          sign = specifier.sign,
          symbol = specifier.symbol,
          zero = specifier.zero,
          width = specifier.width,
          comma = specifier.comma,
          precision = specifier.precision,
          trim = specifier.trim,
          type = specifier.type;

      // The "n" type is an alias for ",g".
      if (type === "n") comma = true, type = "g";

      // The "" type, and any invalid type, is an alias for ".12~g".
      else if (!formatTypes[type]) precision == null && (precision = 12), trim = true, type = "g";

      // If zero fill is specified, padding goes after sign and before digits.
      if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

      // Compute the prefix and suffix.
      // For SI-prefix, the suffix is lazily computed.
      var prefix = symbol === "$" ? currency[0] : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
          suffix = symbol === "$" ? currency[1] : /[%p]/.test(type) ? percent : "";

      // What format function should we use?
      // Is this an integer type?
      // Can this type generate exponential notation?
      var formatType = formatTypes[type],
          maybeSuffix = /[defgprs%]/.test(type);

      // Set the default precision if not specified,
      // or clamp the specified precision to the supported range.
      // For significant precision, it must be in [1, 21].
      // For fixed precision, it must be in [0, 20].
      precision = precision == null ? 6
          : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
          : Math.max(0, Math.min(20, precision));

      function format(value) {
        var valuePrefix = prefix,
            valueSuffix = suffix,
            i, n, c;

        if (type === "c") {
          valueSuffix = formatType(value) + valueSuffix;
          value = "";
        } else {
          value = +value;

          // Perform the initial formatting.
          var valueNegative = value < 0;
          value = formatType(Math.abs(value), precision);

          // Trim insignificant zeros.
          if (trim) value = formatTrim(value);

          // If a negative value rounds to zero during formatting, treat as positive.
          if (valueNegative && +value === 0) valueNegative = false;

          // Compute the prefix and suffix.
          valuePrefix = (valueNegative ? (sign === "(" ? sign : "-") : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
          valueSuffix = (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

          // Break the formatted value into the integer “value” part that can be
          // grouped, and fractional or exponential “suffix” part that is not.
          if (maybeSuffix) {
            i = -1, n = value.length;
            while (++i < n) {
              if (c = value.charCodeAt(i), 48 > c || c > 57) {
                valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                value = value.slice(0, i);
                break;
              }
            }
          }
        }

        // If the fill character is not "0", grouping is applied before padding.
        if (comma && !zero) value = group(value, Infinity);

        // Compute the padding.
        var length = valuePrefix.length + value.length + valueSuffix.length,
            padding = length < width ? new Array(width - length + 1).join(fill) : "";

        // If the fill character is "0", grouping is applied after padding.
        if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

        // Reconstruct the final output based on the desired alignment.
        switch (align) {
          case "<": value = valuePrefix + value + valueSuffix + padding; break;
          case "=": value = valuePrefix + padding + value + valueSuffix; break;
          case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
          default: value = padding + valuePrefix + value + valueSuffix; break;
        }

        return numerals(value);
      }

      format.toString = function() {
        return specifier + "";
      };

      return format;
    }

    function formatPrefix(specifier, value) {
      var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
          e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
          k = Math.pow(10, -e),
          prefix = prefixes[8 + e / 3];
      return function(value) {
        return f(k * value) + prefix;
      };
    }

    return {
      format: newFormat,
      formatPrefix: formatPrefix
    };
  }

  var locale;
  var format;
  var formatPrefix;

  defaultLocale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["$", ""]
  });

  function defaultLocale(definition) {
    locale = formatLocale(definition);
    format = locale.format;
    formatPrefix = locale.formatPrefix;
    return locale;
  }

  function precisionFixed(step) {
    return Math.max(0, -exponent(Math.abs(step)));
  }

  function precisionPrefix(step, value) {
    return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
  }

  function precisionRound(step, max) {
    step = Math.abs(step), max = Math.abs(max) - step;
    return Math.max(0, exponent(max) - exponent(step)) + 1;
  }

  function tickFormat(domain, count, specifier) {
    var start = domain[0],
        stop = domain[domain.length - 1],
        step = tickStep(start, stop, count == null ? 10 : count),
        precision;
    specifier = formatSpecifier(specifier == null ? ",f" : specifier);
    switch (specifier.type) {
      case "s": {
        var value = Math.max(Math.abs(start), Math.abs(stop));
        if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
        return formatPrefix(specifier, value);
      }
      case "":
      case "e":
      case "g":
      case "p":
      case "r": {
        if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
        break;
      }
      case "f":
      case "%": {
        if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
        break;
      }
    }
    return format(specifier);
  }

  function linearish(scale) {
    var domain = scale.domain;

    scale.ticks = function(count) {
      var d = domain();
      return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
    };

    scale.tickFormat = function(count, specifier) {
      return tickFormat(domain(), count, specifier);
    };

    scale.nice = function(count) {
      if (count == null) count = 10;

      var d = domain(),
          i0 = 0,
          i1 = d.length - 1,
          start = d[i0],
          stop = d[i1],
          step;

      if (stop < start) {
        step = start, start = stop, stop = step;
        step = i0, i0 = i1, i1 = step;
      }

      step = tickIncrement(start, stop, count);

      if (step > 0) {
        start = Math.floor(start / step) * step;
        stop = Math.ceil(stop / step) * step;
        step = tickIncrement(start, stop, count);
      } else if (step < 0) {
        start = Math.ceil(start * step) / step;
        stop = Math.floor(stop * step) / step;
        step = tickIncrement(start, stop, count);
      }

      if (step > 0) {
        d[i0] = Math.floor(start / step) * step;
        d[i1] = Math.ceil(stop / step) * step;
        domain(d);
      } else if (step < 0) {
        d[i0] = Math.ceil(start * step) / step;
        d[i1] = Math.floor(stop * step) / step;
        domain(d);
      }

      return scale;
    };

    return scale;
  }

  function linear$1() {
    var scale = continuous(deinterpolateLinear, number$1);

    scale.copy = function() {
      return copy(scale, linear$1());
    };

    return linearish(scale);
  }

  var t0$1 = new Date,
      t1$1 = new Date;

  function newInterval(floori, offseti, count, field) {

    function interval(date) {
      return floori(date = new Date(+date)), date;
    }

    interval.floor = interval;

    interval.ceil = function(date) {
      return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
    };

    interval.round = function(date) {
      var d0 = interval(date),
          d1 = interval.ceil(date);
      return date - d0 < d1 - date ? d0 : d1;
    };

    interval.offset = function(date, step) {
      return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };

    interval.range = function(start, stop, step) {
      var range = [], previous;
      start = interval.ceil(start);
      step = step == null ? 1 : Math.floor(step);
      if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
      do range.push(previous = new Date(+start)), offseti(start, step), floori(start);
      while (previous < start && start < stop);
      return range;
    };

    interval.filter = function(test) {
      return newInterval(function(date) {
        if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
      }, function(date, step) {
        if (date >= date) {
          if (step < 0) while (++step <= 0) {
            while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty
          } else while (--step >= 0) {
            while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty
          }
        }
      });
    };

    if (count) {
      interval.count = function(start, end) {
        t0$1.setTime(+start), t1$1.setTime(+end);
        floori(t0$1), floori(t1$1);
        return Math.floor(count(t0$1, t1$1));
      };

      interval.every = function(step) {
        step = Math.floor(step);
        return !isFinite(step) || !(step > 0) ? null
            : !(step > 1) ? interval
            : interval.filter(field
                ? function(d) { return field(d) % step === 0; }
                : function(d) { return interval.count(0, d) % step === 0; });
      };
    }

    return interval;
  }

  var millisecond = newInterval(function() {
    // noop
  }, function(date, step) {
    date.setTime(+date + step);
  }, function(start, end) {
    return end - start;
  });

  // An optimized implementation for this simple case.
  millisecond.every = function(k) {
    k = Math.floor(k);
    if (!isFinite(k) || !(k > 0)) return null;
    if (!(k > 1)) return millisecond;
    return newInterval(function(date) {
      date.setTime(Math.floor(date / k) * k);
    }, function(date, step) {
      date.setTime(+date + step * k);
    }, function(start, end) {
      return (end - start) / k;
    });
  };
  var milliseconds = millisecond.range;

  var durationSecond = 1e3;
  var durationMinute = 6e4;
  var durationHour = 36e5;
  var durationDay = 864e5;
  var durationWeek = 6048e5;

  var second = newInterval(function(date) {
    date.setTime(Math.floor(date / durationSecond) * durationSecond);
  }, function(date, step) {
    date.setTime(+date + step * durationSecond);
  }, function(start, end) {
    return (end - start) / durationSecond;
  }, function(date) {
    return date.getUTCSeconds();
  });
  var seconds = second.range;

  var minute = newInterval(function(date) {
    date.setTime(Math.floor(date / durationMinute) * durationMinute);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute);
  }, function(start, end) {
    return (end - start) / durationMinute;
  }, function(date) {
    return date.getMinutes();
  });
  var minutes = minute.range;

  var hour = newInterval(function(date) {
    var offset = date.getTimezoneOffset() * durationMinute % durationHour;
    if (offset < 0) offset += durationHour;
    date.setTime(Math.floor((+date - offset) / durationHour) * durationHour + offset);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getHours();
  });
  var hours = hour.range;

  var day = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay;
  }, function(date) {
    return date.getDate() - 1;
  });
  var days = day.range;

  function weekday(i) {
    return newInterval(function(date) {
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setDate(date.getDate() + step * 7);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
    });
  }

  var sunday = weekday(0);
  var monday = weekday(1);
  var tuesday = weekday(2);
  var wednesday = weekday(3);
  var thursday = weekday(4);
  var friday = weekday(5);
  var saturday = weekday(6);

  var sundays = sunday.range;
  var mondays = monday.range;
  var thursdays = thursday.range;

  var month = newInterval(function(date) {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setMonth(date.getMonth() + step);
  }, function(start, end) {
    return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
  }, function(date) {
    return date.getMonth();
  });
  var months = month.range;

  var year = newInterval(function(date) {
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step);
  }, function(start, end) {
    return end.getFullYear() - start.getFullYear();
  }, function(date) {
    return date.getFullYear();
  });

  // An optimized implementation for this simple case.
  year.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
      date.setFullYear(Math.floor(date.getFullYear() / k) * k);
      date.setMonth(0, 1);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setFullYear(date.getFullYear() + step * k);
    });
  };
  var years = year.range;

  var utcMinute = newInterval(function(date) {
    date.setUTCSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute);
  }, function(start, end) {
    return (end - start) / durationMinute;
  }, function(date) {
    return date.getUTCMinutes();
  });
  var utcMinutes = utcMinute.range;

  var utcHour = newInterval(function(date) {
    date.setUTCMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getUTCHours();
  });
  var utcHours = utcHour.range;

  var utcDay = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / durationDay;
  }, function(date) {
    return date.getUTCDate() - 1;
  });
  var utcDays = utcDay.range;

  function utcWeekday(i) {
    return newInterval(function(date) {
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, function(start, end) {
      return (end - start) / durationWeek;
    });
  }

  var utcSunday = utcWeekday(0);
  var utcMonday = utcWeekday(1);
  var utcTuesday = utcWeekday(2);
  var utcWednesday = utcWeekday(3);
  var utcThursday = utcWeekday(4);
  var utcFriday = utcWeekday(5);
  var utcSaturday = utcWeekday(6);

  var utcSundays = utcSunday.range;
  var utcMondays = utcMonday.range;
  var utcThursdays = utcThursday.range;

  var utcMonth = newInterval(function(date) {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCMonth(date.getUTCMonth() + step);
  }, function(start, end) {
    return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  }, function(date) {
    return date.getUTCMonth();
  });
  var utcMonths = utcMonth.range;

  var utcYear = newInterval(function(date) {
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step);
  }, function(start, end) {
    return end.getUTCFullYear() - start.getUTCFullYear();
  }, function(date) {
    return date.getUTCFullYear();
  });

  // An optimized implementation for this simple case.
  utcYear.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
      date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCFullYear(date.getUTCFullYear() + step * k);
    });
  };
  var utcYears = utcYear.range;

  function localDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
      date.setFullYear(d.y);
      return date;
    }
    return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
  }

  function utcDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
      date.setUTCFullYear(d.y);
      return date;
    }
    return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
  }

  function newYear(y) {
    return {y: y, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0};
  }

  function formatLocale$1(locale) {
    var locale_dateTime = locale.dateTime,
        locale_date = locale.date,
        locale_time = locale.time,
        locale_periods = locale.periods,
        locale_weekdays = locale.days,
        locale_shortWeekdays = locale.shortDays,
        locale_months = locale.months,
        locale_shortMonths = locale.shortMonths;

    var periodRe = formatRe(locale_periods),
        periodLookup = formatLookup(locale_periods),
        weekdayRe = formatRe(locale_weekdays),
        weekdayLookup = formatLookup(locale_weekdays),
        shortWeekdayRe = formatRe(locale_shortWeekdays),
        shortWeekdayLookup = formatLookup(locale_shortWeekdays),
        monthRe = formatRe(locale_months),
        monthLookup = formatLookup(locale_months),
        shortMonthRe = formatRe(locale_shortMonths),
        shortMonthLookup = formatLookup(locale_shortMonths);

    var formats = {
      "a": formatShortWeekday,
      "A": formatWeekday,
      "b": formatShortMonth,
      "B": formatMonth,
      "c": null,
      "d": formatDayOfMonth,
      "e": formatDayOfMonth,
      "f": formatMicroseconds,
      "H": formatHour24,
      "I": formatHour12,
      "j": formatDayOfYear,
      "L": formatMilliseconds,
      "m": formatMonthNumber,
      "M": formatMinutes,
      "p": formatPeriod,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatSeconds,
      "u": formatWeekdayNumberMonday,
      "U": formatWeekNumberSunday,
      "V": formatWeekNumberISO,
      "w": formatWeekdayNumberSunday,
      "W": formatWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatYear,
      "Y": formatFullYear,
      "Z": formatZone,
      "%": formatLiteralPercent
    };

    var utcFormats = {
      "a": formatUTCShortWeekday,
      "A": formatUTCWeekday,
      "b": formatUTCShortMonth,
      "B": formatUTCMonth,
      "c": null,
      "d": formatUTCDayOfMonth,
      "e": formatUTCDayOfMonth,
      "f": formatUTCMicroseconds,
      "H": formatUTCHour24,
      "I": formatUTCHour12,
      "j": formatUTCDayOfYear,
      "L": formatUTCMilliseconds,
      "m": formatUTCMonthNumber,
      "M": formatUTCMinutes,
      "p": formatUTCPeriod,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatUTCSeconds,
      "u": formatUTCWeekdayNumberMonday,
      "U": formatUTCWeekNumberSunday,
      "V": formatUTCWeekNumberISO,
      "w": formatUTCWeekdayNumberSunday,
      "W": formatUTCWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatUTCYear,
      "Y": formatUTCFullYear,
      "Z": formatUTCZone,
      "%": formatLiteralPercent
    };

    var parses = {
      "a": parseShortWeekday,
      "A": parseWeekday,
      "b": parseShortMonth,
      "B": parseMonth,
      "c": parseLocaleDateTime,
      "d": parseDayOfMonth,
      "e": parseDayOfMonth,
      "f": parseMicroseconds,
      "H": parseHour24,
      "I": parseHour24,
      "j": parseDayOfYear,
      "L": parseMilliseconds,
      "m": parseMonthNumber,
      "M": parseMinutes,
      "p": parsePeriod,
      "Q": parseUnixTimestamp,
      "s": parseUnixTimestampSeconds,
      "S": parseSeconds,
      "u": parseWeekdayNumberMonday,
      "U": parseWeekNumberSunday,
      "V": parseWeekNumberISO,
      "w": parseWeekdayNumberSunday,
      "W": parseWeekNumberMonday,
      "x": parseLocaleDate,
      "X": parseLocaleTime,
      "y": parseYear,
      "Y": parseFullYear,
      "Z": parseZone,
      "%": parseLiteralPercent
    };

    // These recursive directive definitions must be deferred.
    formats.x = newFormat(locale_date, formats);
    formats.X = newFormat(locale_time, formats);
    formats.c = newFormat(locale_dateTime, formats);
    utcFormats.x = newFormat(locale_date, utcFormats);
    utcFormats.X = newFormat(locale_time, utcFormats);
    utcFormats.c = newFormat(locale_dateTime, utcFormats);

    function newFormat(specifier, formats) {
      return function(date) {
        var string = [],
            i = -1,
            j = 0,
            n = specifier.length,
            c,
            pad,
            format;

        if (!(date instanceof Date)) date = new Date(+date);

        while (++i < n) {
          if (specifier.charCodeAt(i) === 37) {
            string.push(specifier.slice(j, i));
            if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
            else pad = c === "e" ? " " : "0";
            if (format = formats[c]) c = format(date, pad);
            string.push(c);
            j = i + 1;
          }
        }

        string.push(specifier.slice(j, i));
        return string.join("");
      };
    }

    function newParse(specifier, newDate) {
      return function(string) {
        var d = newYear(1900),
            i = parseSpecifier(d, specifier, string += "", 0),
            week, day$$1;
        if (i != string.length) return null;

        // If a UNIX timestamp is specified, return it.
        if ("Q" in d) return new Date(d.Q);

        // The am-pm flag is 0 for AM, and 1 for PM.
        if ("p" in d) d.H = d.H % 12 + d.p * 12;

        // Convert day-of-week and week-of-year to day-of-year.
        if ("V" in d) {
          if (d.V < 1 || d.V > 53) return null;
          if (!("w" in d)) d.w = 1;
          if ("Z" in d) {
            week = utcDate(newYear(d.y)), day$$1 = week.getUTCDay();
            week = day$$1 > 4 || day$$1 === 0 ? utcMonday.ceil(week) : utcMonday(week);
            week = utcDay.offset(week, (d.V - 1) * 7);
            d.y = week.getUTCFullYear();
            d.m = week.getUTCMonth();
            d.d = week.getUTCDate() + (d.w + 6) % 7;
          } else {
            week = newDate(newYear(d.y)), day$$1 = week.getDay();
            week = day$$1 > 4 || day$$1 === 0 ? monday.ceil(week) : monday(week);
            week = day.offset(week, (d.V - 1) * 7);
            d.y = week.getFullYear();
            d.m = week.getMonth();
            d.d = week.getDate() + (d.w + 6) % 7;
          }
        } else if ("W" in d || "U" in d) {
          if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
          day$$1 = "Z" in d ? utcDate(newYear(d.y)).getUTCDay() : newDate(newYear(d.y)).getDay();
          d.m = 0;
          d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day$$1 + 5) % 7 : d.w + d.U * 7 - (day$$1 + 6) % 7;
        }

        // If a time zone is specified, all fields are interpreted as UTC and then
        // offset according to the specified time zone.
        if ("Z" in d) {
          d.H += d.Z / 100 | 0;
          d.M += d.Z % 100;
          return utcDate(d);
        }

        // Otherwise, all fields are in local time.
        return newDate(d);
      };
    }

    function parseSpecifier(d, specifier, string, j) {
      var i = 0,
          n = specifier.length,
          m = string.length,
          c,
          parse;

      while (i < n) {
        if (j >= m) return -1;
        c = specifier.charCodeAt(i++);
        if (c === 37) {
          c = specifier.charAt(i++);
          parse = parses[c in pads ? specifier.charAt(i++) : c];
          if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
        } else if (c != string.charCodeAt(j++)) {
          return -1;
        }
      }

      return j;
    }

    function parsePeriod(d, string, i) {
      var n = periodRe.exec(string.slice(i));
      return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortWeekday(d, string, i) {
      var n = shortWeekdayRe.exec(string.slice(i));
      return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseWeekday(d, string, i) {
      var n = weekdayRe.exec(string.slice(i));
      return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortMonth(d, string, i) {
      var n = shortMonthRe.exec(string.slice(i));
      return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseMonth(d, string, i) {
      var n = monthRe.exec(string.slice(i));
      return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseLocaleDateTime(d, string, i) {
      return parseSpecifier(d, locale_dateTime, string, i);
    }

    function parseLocaleDate(d, string, i) {
      return parseSpecifier(d, locale_date, string, i);
    }

    function parseLocaleTime(d, string, i) {
      return parseSpecifier(d, locale_time, string, i);
    }

    function formatShortWeekday(d) {
      return locale_shortWeekdays[d.getDay()];
    }

    function formatWeekday(d) {
      return locale_weekdays[d.getDay()];
    }

    function formatShortMonth(d) {
      return locale_shortMonths[d.getMonth()];
    }

    function formatMonth(d) {
      return locale_months[d.getMonth()];
    }

    function formatPeriod(d) {
      return locale_periods[+(d.getHours() >= 12)];
    }

    function formatUTCShortWeekday(d) {
      return locale_shortWeekdays[d.getUTCDay()];
    }

    function formatUTCWeekday(d) {
      return locale_weekdays[d.getUTCDay()];
    }

    function formatUTCShortMonth(d) {
      return locale_shortMonths[d.getUTCMonth()];
    }

    function formatUTCMonth(d) {
      return locale_months[d.getUTCMonth()];
    }

    function formatUTCPeriod(d) {
      return locale_periods[+(d.getUTCHours() >= 12)];
    }

    return {
      format: function(specifier) {
        var f = newFormat(specifier += "", formats);
        f.toString = function() { return specifier; };
        return f;
      },
      parse: function(specifier) {
        var p = newParse(specifier += "", localDate);
        p.toString = function() { return specifier; };
        return p;
      },
      utcFormat: function(specifier) {
        var f = newFormat(specifier += "", utcFormats);
        f.toString = function() { return specifier; };
        return f;
      },
      utcParse: function(specifier) {
        var p = newParse(specifier, utcDate);
        p.toString = function() { return specifier; };
        return p;
      }
    };
  }

  var pads = {"-": "", "_": " ", "0": "0"},
      numberRe = /^\s*\d+/, // note: ignores next directive
      percentRe = /^%/,
      requoteRe = /[\\^$*+?|[\]().{}]/g;

  function pad(value, fill, width) {
    var sign = value < 0 ? "-" : "",
        string = (sign ? -value : value) + "",
        length = string.length;
    return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
  }

  function requote(s) {
    return s.replace(requoteRe, "\\$&");
  }

  function formatRe(names) {
    return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
  }

  function formatLookup(names) {
    var map = {}, i = -1, n = names.length;
    while (++i < n) map[names[i].toLowerCase()] = i;
    return map;
  }

  function parseWeekdayNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.w = +n[0], i + n[0].length) : -1;
  }

  function parseWeekdayNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.u = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.U = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberISO(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.V = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.W = +n[0], i + n[0].length) : -1;
  }

  function parseFullYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 4));
    return n ? (d.y = +n[0], i + n[0].length) : -1;
  }

  function parseYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
  }

  function parseZone(d, string, i) {
    var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
    return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
  }

  function parseMonthNumber(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
  }

  function parseDayOfMonth(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.d = +n[0], i + n[0].length) : -1;
  }

  function parseDayOfYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
  }

  function parseHour24(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.H = +n[0], i + n[0].length) : -1;
  }

  function parseMinutes(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.M = +n[0], i + n[0].length) : -1;
  }

  function parseSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.S = +n[0], i + n[0].length) : -1;
  }

  function parseMilliseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.L = +n[0], i + n[0].length) : -1;
  }

  function parseMicroseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 6));
    return n ? (d.L = Math.floor(n[0] / 1000), i + n[0].length) : -1;
  }

  function parseLiteralPercent(d, string, i) {
    var n = percentRe.exec(string.slice(i, i + 1));
    return n ? i + n[0].length : -1;
  }

  function parseUnixTimestamp(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.Q = +n[0], i + n[0].length) : -1;
  }

  function parseUnixTimestampSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.Q = (+n[0]) * 1000, i + n[0].length) : -1;
  }

  function formatDayOfMonth(d, p) {
    return pad(d.getDate(), p, 2);
  }

  function formatHour24(d, p) {
    return pad(d.getHours(), p, 2);
  }

  function formatHour12(d, p) {
    return pad(d.getHours() % 12 || 12, p, 2);
  }

  function formatDayOfYear(d, p) {
    return pad(1 + day.count(year(d), d), p, 3);
  }

  function formatMilliseconds(d, p) {
    return pad(d.getMilliseconds(), p, 3);
  }

  function formatMicroseconds(d, p) {
    return formatMilliseconds(d, p) + "000";
  }

  function formatMonthNumber(d, p) {
    return pad(d.getMonth() + 1, p, 2);
  }

  function formatMinutes(d, p) {
    return pad(d.getMinutes(), p, 2);
  }

  function formatSeconds(d, p) {
    return pad(d.getSeconds(), p, 2);
  }

  function formatWeekdayNumberMonday(d) {
    var day$$1 = d.getDay();
    return day$$1 === 0 ? 7 : day$$1;
  }

  function formatWeekNumberSunday(d, p) {
    return pad(sunday.count(year(d), d), p, 2);
  }

  function formatWeekNumberISO(d, p) {
    var day$$1 = d.getDay();
    d = (day$$1 >= 4 || day$$1 === 0) ? thursday(d) : thursday.ceil(d);
    return pad(thursday.count(year(d), d) + (year(d).getDay() === 4), p, 2);
  }

  function formatWeekdayNumberSunday(d) {
    return d.getDay();
  }

  function formatWeekNumberMonday(d, p) {
    return pad(monday.count(year(d), d), p, 2);
  }

  function formatYear(d, p) {
    return pad(d.getFullYear() % 100, p, 2);
  }

  function formatFullYear(d, p) {
    return pad(d.getFullYear() % 10000, p, 4);
  }

  function formatZone(d) {
    var z = d.getTimezoneOffset();
    return (z > 0 ? "-" : (z *= -1, "+"))
        + pad(z / 60 | 0, "0", 2)
        + pad(z % 60, "0", 2);
  }

  function formatUTCDayOfMonth(d, p) {
    return pad(d.getUTCDate(), p, 2);
  }

  function formatUTCHour24(d, p) {
    return pad(d.getUTCHours(), p, 2);
  }

  function formatUTCHour12(d, p) {
    return pad(d.getUTCHours() % 12 || 12, p, 2);
  }

  function formatUTCDayOfYear(d, p) {
    return pad(1 + utcDay.count(utcYear(d), d), p, 3);
  }

  function formatUTCMilliseconds(d, p) {
    return pad(d.getUTCMilliseconds(), p, 3);
  }

  function formatUTCMicroseconds(d, p) {
    return formatUTCMilliseconds(d, p) + "000";
  }

  function formatUTCMonthNumber(d, p) {
    return pad(d.getUTCMonth() + 1, p, 2);
  }

  function formatUTCMinutes(d, p) {
    return pad(d.getUTCMinutes(), p, 2);
  }

  function formatUTCSeconds(d, p) {
    return pad(d.getUTCSeconds(), p, 2);
  }

  function formatUTCWeekdayNumberMonday(d) {
    var dow = d.getUTCDay();
    return dow === 0 ? 7 : dow;
  }

  function formatUTCWeekNumberSunday(d, p) {
    return pad(utcSunday.count(utcYear(d), d), p, 2);
  }

  function formatUTCWeekNumberISO(d, p) {
    var day$$1 = d.getUTCDay();
    d = (day$$1 >= 4 || day$$1 === 0) ? utcThursday(d) : utcThursday.ceil(d);
    return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
  }

  function formatUTCWeekdayNumberSunday(d) {
    return d.getUTCDay();
  }

  function formatUTCWeekNumberMonday(d, p) {
    return pad(utcMonday.count(utcYear(d), d), p, 2);
  }

  function formatUTCYear(d, p) {
    return pad(d.getUTCFullYear() % 100, p, 2);
  }

  function formatUTCFullYear(d, p) {
    return pad(d.getUTCFullYear() % 10000, p, 4);
  }

  function formatUTCZone() {
    return "+0000";
  }

  function formatLiteralPercent() {
    return "%";
  }

  function formatUnixTimestamp(d) {
    return +d;
  }

  function formatUnixTimestampSeconds(d) {
    return Math.floor(+d / 1000);
  }

  var locale$1;
  var timeFormat;
  var timeParse;
  var utcFormat;
  var utcParse;

  defaultLocale$1({
    dateTime: "%x, %X",
    date: "%-m/%-d/%Y",
    time: "%-I:%M:%S %p",
    periods: ["AM", "PM"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });

  function defaultLocale$1(definition) {
    locale$1 = formatLocale$1(definition);
    timeFormat = locale$1.format;
    timeParse = locale$1.parse;
    utcFormat = locale$1.utcFormat;
    utcParse = locale$1.utcParse;
    return locale$1;
  }

  var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

  function formatIsoNative(date) {
    return date.toISOString();
  }

  var formatIso = Date.prototype.toISOString
      ? formatIsoNative
      : utcFormat(isoSpecifier);

  function parseIsoNative(string) {
    var date = new Date(string);
    return isNaN(date) ? null : date;
  }

  var parseIso = +new Date("2000-01-01T00:00:00.000Z")
      ? parseIsoNative
      : utcParse(isoSpecifier);

  function sequential(interpolator) {
    var x0 = 0,
        x1 = 1,
        k10 = 1,
        clamp = false;

    function scale(x) {
      var t = (x - x0) * k10;
      return interpolator(clamp ? Math.max(0, Math.min(1, t)) : t);
    }

    scale.domain = function(_) {
      return arguments.length ? (x0 = +_[0], x1 = +_[1], k10 = x0 === x1 ? 0 : 1 / (x1 - x0), scale) : [x0, x1];
    };

    scale.clamp = function(_) {
      return arguments.length ? (clamp = !!_, scale) : clamp;
    };

    scale.interpolator = function(_) {
      return arguments.length ? (interpolator = _, scale) : interpolator;
    };

    scale.copy = function() {
      return sequential(interpolator).domain([x0, x1]).clamp(clamp);
    };

    return linearish(scale);
  }

  function getGtexUrls(){
      const host = 'https://gtexportal.org/rest/v1/';
      // const host = 'local.gtexportal.org/rest/v1/'
      return {
          // eqtl Dashboard specific
          dyneqtl: host + 'association/dyneqtl',
          snp: host + 'reference/variant?format=json&snpId=',
          variantId: host + 'dataset/variant?format=json&variantId=',

          // transcript, exon, junction expression specific
          exonExp: host + 'expression/medianExonExpression?datasetId=gtex_v7&hcluster=true&gencodeId=',
          transcriptExp: host + 'expression/medianTranscriptExpression?datasetId=gtex_v7&hcluster=true&gencodeId=',
          junctionExp: host + 'expression/medianJunctionExpression?datasetId=gtex_v7&hcluster=true&gencodeId=',
          transcript: host + 'reference/transcript?datasetId=gtex_v7&gencodeId=',
          exon: host + 'reference/exon?datasetId=gtex_v7&gencodeId=',
          geneModel: host + 'dataset/collapsedGeneModelExon?datasetId=gtex_v7&gencodeId=',
          geneModelUnfiltered: host + 'dataset/fullCCollapsedGeneModelExon?datasetId=gtex_v7&gencodeId=',

          // gene expression violin plot specific
          geneExp: host + 'expression/geneExpression?datasetId=gtex_v7&gencodeId=',

          // gene expression heat map specific
          medGeneExp: host + 'expression/medianGeneExpression?datasetId=gtex_v7&hcluster=true&pageSize=10000',

          // top expressed gene expression specific
          topInTissueFiltered: host + 'expression/topExpressedGene?datasetId=gtex_v7&filterMtGene=true&sortBy=median&sortDirection=desc&pageSize=50&tissueSiteDetailId=',
          topInTissue: host + 'expression/topExpressedGene?datasetId=gtex_v7&sortBy=median&sortDirection=desc&pageSize=50&tissueSiteDetailId=',

          geneId: host + 'reference/gene?format=json&gencodeVersion=v19&genomeBuild=GRCh37%2Fhg19&geneId=',

          // tissue menu specific
          tissue:  host + 'metadata/tissueSiteDetail?format=json',

          tissueSites: host + 'metadata/tissueSiteDetail?format=json',

          // local static files
          sample: 'tmpSummaryData/gtex.Sample.csv',
          rnaseqCram: 'tmpSummaryData/rnaseq_cram_files_v7_dbGaP_011516.txt',
          wgsCram: 'tmpSummaryData/wgs_cram_files_v7_hg38_dbGaP_011516.txt',

          // fireCloud
          fcBilling: 'https://api.firecloud.org/api/profile/billing',
          fcWorkSpace: 'https://api.firecloud.org/api/workspaces',
          fcPortalWorkSpace: 'https://portal.firecloud.org/#workspaces'
      }
  }

  /**
   * Parse the tissues
   * @param data {Json}
   * @returns {List} of tissues
   */
  function parseTissues(json){
      const attr = 'tissueSiteDetail';
      if(!json.hasOwnProperty(attr)) throw 'Parse Error: required json attr is missing: ' + attr;
      const tissues = json[attr];

      // sanity check
      ['tissueSiteDetailId', 'tissueSiteDetail', 'colorHex'].forEach((d)=>{
          if (!tissues[0].hasOwnProperty(d)) throw 'Parse Error: required json attr is missing: ' + d;
      });

      return tissues;
  }

  /**
   * parse the exons
   * @param data {Json}
   * @param full {Boolean}
   * @returns {List} of exons
   */
  function parseModelExons(json){
      const attr = 'collapsedGeneModelExon';
      if(!json.hasOwnProperty(attr)){
          console.error(json);
          throw 'Parse Error: Required json attribute is missing: ' + attr;
      }
      // sanity check
      ['start', 'end'].forEach((d)=>{
          if (!json[attr][0].hasOwnProperty(d)) throw 'Parse Error: Required json attribute is missing: ' + d;
      });
      return json[attr].map((d)=>{
          d.chromStart = d.start;
          d.chromEnd = d.end;
          return d;
      });
  }

  /**
   * parse the junctions
   * @param data
   * @returns {List} of junctions
   * // junction annotations are not stored in Mongo
      // so here we use the junction expression web service to parse the junction ID for its genomic location
      // assuming that each tissue has the same junctions,
      // to grab all the known junctions of a gene, we only need to query one tissue
      // here we arbitrarily pick Liver.
   */
  function parseJunctions(json){

      const attr = 'medianJunctionExpression';
      if(!json.hasOwnProperty(attr)) throw 'Parse Error: parseJunctions input error. ' + attr;

      // check required json attributes
      ['tissueSiteDetailId', 'junctionId'].forEach((d)=>{
          // use the first element in the json objects as a test case
          if(!json[attr][0].hasOwnProperty(d)){
              console.error(json[attr][0]);
              throw 'Parse Error: required junction attribute is missing: ' + d;
          }
      });
      return json[attr].filter((d)=>d.tissueSiteDetailId=='Liver')
                      .map((d) => {
                          let pos = d.junctionId.split('_');
                          return {
                              chrom: pos[0],
                              chromStart: pos[1],
                              chromEnd: pos[2],
                              junctionId: d.junctionId
                          }
                      });
  }

  /**
   * parse transcript isoforms from the GTEx web service: 'reference/transcript?release=v7&gencode_id='
   * @param data {Json}
   * returns a dictionary of transcript exon object lists indexed by transcript IDs -- ENST IDs
   */
  function parseExons(json){
      const attr = 'exon';
      if(!json.hasOwnProperty(attr)) throw 'Parse Error: required json attribute is missing: exon';
      return json[attr].reduce((a, d)=>{
          // check required attributes
          ['transcriptId', 'chromosome', 'start', 'end', 'exonNumber', 'exonId'].forEach((k)=>{
              if(!d.hasOwnProperty(k)) {
                  console.error(d);
                  throw 'Parse Error: required json attribute is missing: ' + k
              }
          });
          if (a[d.transcriptId] === undefined) a[d.transcriptId] = [];
          d.chrom = d.chromosome;
          d.chromStart = d.start;
          d.chromEnd = d.end;
          a[d.transcriptId].push(d);
          return a;
      }, {});
  }

  /**
   * parse transcript isoforms
   * @param data {Json} from GTEx web service 'reference/transcript?release=v7&gencode_id='
   * returns a list of isoform objects sorted by length in descending order
   */
  function parseTranscripts(json){
      const attr = 'transcript';
      if(!json.hasOwnProperty(attr)) throw('parseIsoforms input error');

      // check required attributes, use the first transcript as the test case
      ['transcriptId', 'start', 'end'].forEach((k)=>{
          if(!json[attr][0].hasOwnProperty(k)) {
              console.error(d);
              throw 'Parse Error: required json attribute is missing: ' + k
          }
      });

      return json[attr].sort((a, b)=>{
          const l1 = Math.abs(a.end - a.start) + 1;
          const l2 = Math.abs(b.end - b.start) + 1;
          return -(l1-l2); // sort by isoform length in descending order
      });
  }

  /**
   * parse final (masked) gene model exon expression
   * expression is normalized to reads per kb
   * @param data {JSON} of exon expression web service
   * @param exons {List} of exons with positions
   * @param useLog {boolean} use log2 transformation
   * @param adjust {Number} default 0.01
   * @returns {List} of exon objects
   */
  function parseExonExpression(data, exons, useLog=true, adjust=1){
      const exonDict = exons.reduce((a, d)=>{a[d.exonId] = d; return a;}, {});
      const attr = 'medianExonExpression';
      if(!data.hasOwnProperty(attr)) throw('parseExonExpression input error');

      const exonObjects = data[attr];
      // error-checking
      ['median', 'exonId', 'tissueSiteDetailId'].forEach((d)=>{
          if (!exonObjects[0].hasOwnProperty(d)) throw 'Fatal Error: parseExonExpression attr not found: ' + d;
      });
      // parse GTEx median exon counts
      exonObjects.forEach((d) => {
          const exon = exonDict[d.exonId]; // for retrieving exon positions
          // error-checking
          ['end', 'start'].forEach((p)=>{
              if (!exon.hasOwnProperty(p)) throw 'Fatal Error: parseExonExpression position attr not found: ' + p;
          });
          d.l = exon.end - exon.start + 1;
          d.value = Number(d.median)/d.l;
          d.originalValue = Number(d.median)/d.l;
          if (useLog) d.value = Math.log2(d.value + 1);
          d.x = d.exonId;
          d.y = d.tissueSiteDetailId;
          d.id = d.gencodeId;
          d.chromStart = exon.start;
          d.chromEnd = exon.end;
          d.unit = 'median ' + d.unit + ' per base';
          d.tissueId = d.tissueSiteDetailId;
      });
      return exonObjects.sort((a,b)=>{
          if (a.chromStart<b.chromStart) return -1;
          if (a.chromStart>b.chromStart) return 1;
          return 0;
      }); // sort by genomic location in ascending order
  }

  /**
   * Parse junction median read count data
   * @param data {JSON} of the junction expression web service
   * @param useLog {Boolean} perform log transformation
   * @param adjust {Number} for handling 0's when useLog is true
   * @returns {List} of junction objects
   */
  function parseJunctionExpression(data, useLog=true, adjust=1){
      const attr = 'medianJunctionExpression';
      if(!data.hasOwnProperty(attr)) throw('parseJunctionExpression input error');

      const junctions = data[attr];

      // error-checking
      if (junctions === undefined || junctions.length == 0) {
          console.warn('No junction data found');
          return undefined;
      }


      // parse GTEx median junction read counts
      junctions.forEach((d) => {
          ['tissueSiteDetailId', 'junctionId', 'median', 'gencodeId'].forEach((k)=>{
              if (!d.hasOwnProperty(k)) {
                  console.error(d);
                  throw 'Parser Error: parseJunctionExpression attr not found: ' + k;
              }
          });
          let median = d.median;
          let tissueId = d.tissueSiteDetailId;
          d.tissueId = tissueId;
          d.id = d.gencodeId;
          d.x = d.junctionId;
          d.y = tissueId;
          d.value = useLog?Math.log10(Number(median + adjust)):Number(median);
          d.originalValue = Number(median);
      });

      // sort by genomic location in ascending order
      return junctions.sort((a,b)=>{
          if (a.junctionId>b.junctionId) return 1;
          else if (a.junctionId<b.junctionId) return -1;
          return 0;
      });
  }

  /**
   * parse transcript expression
   * @param data
   * @param useLog
   * @param adjust
   * @returns {*}
   */
  function parseTranscriptExpression(data, useLog=true, adjust=1){
      const attr = 'medianTranscriptExpression';
      if(!data.hasOwnProperty(attr)) throw('Parse Error: parseTranscriptExpression input error');
      // parse GTEx isoform median TPM
      data[attr].forEach((d) => {
          ['median', 'transcriptId', 'tissueSiteDetailId', 'gencodeId'].forEach((k)=>{
              if(!d.hasOwnProperty(k)) {
                  console.error(d);
                  throw('Parse Error: required transcipt attribute is missing: ' + k);
              }
          });
          d.value = useLog?Math.log10(Number(d.median + adjust)):Number(d.median);
          d.originalValue = Number(d.median);
          d.x = d.transcriptId;
          d.y = d.tissueSiteDetailId;
          d.id = d.gencodeId;
          d.tissueId = d.tissueSiteDetailId;
      });

      return data[attr];
  }

  function parseTranscriptExpressionTranspose(data, useLog=true, adjust=1){
      const attr = 'medianTranscriptExpression';
      if(!data.hasOwnProperty(attr)) {
          console.error(data);
          throw('Parse Error: parseTranscriptExpressionTranspose input error.');
      }
      // parse GTEx isoform median TPM
      data[attr].forEach((d) => {
          ['median', 'transcriptId', 'tissueSiteDetailId', 'gencodeId'].forEach((k)=>{
              if(!d.hasOwnProperty(k)) {
                  console.error(d);
                  throw('Parse Error: Required transcript attribute is missing: ' + k);
              }
          });
          const median = d.median;
          const tissueId = d.tissueSiteDetailId;
          d.value = useLog?Math.log10(Number(median + adjust)):Number(median);
          d.originalValue = Number(median);
          d.y = d.transcriptId;
          d.x = tissueId;
          d.id = d.gencodeId;
          d.tissueId = tissueId;
      });

      return data[attr];
  }

  function colors(specifier) {
    var n = specifier.length / 6 | 0, colors = new Array(n), i = 0;
    while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
    return colors;
  }

  colors("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

  colors("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666");

  colors("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666");

  colors("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");

  colors("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2");

  colors("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc");

  colors("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999");

  colors("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3");

  colors("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f");

  function ramp(scheme) {
    return rgbBasis(scheme[scheme.length - 1]);
  }

  var scheme = new Array(3).concat(
    "d8b365f5f5f55ab4ac",
    "a6611adfc27d80cdc1018571",
    "a6611adfc27df5f5f580cdc1018571",
    "8c510ad8b365f6e8c3c7eae55ab4ac01665e",
    "8c510ad8b365f6e8c3f5f5f5c7eae55ab4ac01665e",
    "8c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e",
    "8c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e",
    "5430058c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e003c30",
    "5430058c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e003c30"
  ).map(colors);

  ramp(scheme);

  var scheme$1 = new Array(3).concat(
    "af8dc3f7f7f77fbf7b",
    "7b3294c2a5cfa6dba0008837",
    "7b3294c2a5cff7f7f7a6dba0008837",
    "762a83af8dc3e7d4e8d9f0d37fbf7b1b7837",
    "762a83af8dc3e7d4e8f7f7f7d9f0d37fbf7b1b7837",
    "762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b7837",
    "762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b7837",
    "40004b762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b783700441b",
    "40004b762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b783700441b"
  ).map(colors);

  ramp(scheme$1);

  var scheme$2 = new Array(3).concat(
    "e9a3c9f7f7f7a1d76a",
    "d01c8bf1b6dab8e1864dac26",
    "d01c8bf1b6daf7f7f7b8e1864dac26",
    "c51b7de9a3c9fde0efe6f5d0a1d76a4d9221",
    "c51b7de9a3c9fde0eff7f7f7e6f5d0a1d76a4d9221",
    "c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221",
    "c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221",
    "8e0152c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221276419",
    "8e0152c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221276419"
  ).map(colors);

  ramp(scheme$2);

  var scheme$3 = new Array(3).concat(
    "998ec3f7f7f7f1a340",
    "5e3c99b2abd2fdb863e66101",
    "5e3c99b2abd2f7f7f7fdb863e66101",
    "542788998ec3d8daebfee0b6f1a340b35806",
    "542788998ec3d8daebf7f7f7fee0b6f1a340b35806",
    "5427888073acb2abd2d8daebfee0b6fdb863e08214b35806",
    "5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b35806",
    "2d004b5427888073acb2abd2d8daebfee0b6fdb863e08214b358067f3b08",
    "2d004b5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b358067f3b08"
  ).map(colors);

  ramp(scheme$3);

  var scheme$4 = new Array(3).concat(
    "ef8a62f7f7f767a9cf",
    "ca0020f4a58292c5de0571b0",
    "ca0020f4a582f7f7f792c5de0571b0",
    "b2182bef8a62fddbc7d1e5f067a9cf2166ac",
    "b2182bef8a62fddbc7f7f7f7d1e5f067a9cf2166ac",
    "b2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac",
    "b2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac",
    "67001fb2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac053061",
    "67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061"
  ).map(colors);

  ramp(scheme$4);

  var scheme$5 = new Array(3).concat(
    "ef8a62ffffff999999",
    "ca0020f4a582bababa404040",
    "ca0020f4a582ffffffbababa404040",
    "b2182bef8a62fddbc7e0e0e09999994d4d4d",
    "b2182bef8a62fddbc7ffffffe0e0e09999994d4d4d",
    "b2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d",
    "b2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d",
    "67001fb2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d1a1a1a",
    "67001fb2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d1a1a1a"
  ).map(colors);

  ramp(scheme$5);

  var scheme$6 = new Array(3).concat(
    "fc8d59ffffbf91bfdb",
    "d7191cfdae61abd9e92c7bb6",
    "d7191cfdae61ffffbfabd9e92c7bb6",
    "d73027fc8d59fee090e0f3f891bfdb4575b4",
    "d73027fc8d59fee090ffffbfe0f3f891bfdb4575b4",
    "d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4",
    "d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4",
    "a50026d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4313695",
    "a50026d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4313695"
  ).map(colors);

  ramp(scheme$6);

  var scheme$7 = new Array(3).concat(
    "fc8d59ffffbf91cf60",
    "d7191cfdae61a6d96a1a9641",
    "d7191cfdae61ffffbfa6d96a1a9641",
    "d73027fc8d59fee08bd9ef8b91cf601a9850",
    "d73027fc8d59fee08bffffbfd9ef8b91cf601a9850",
    "d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850",
    "d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850",
    "a50026d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850006837",
    "a50026d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850006837"
  ).map(colors);

  ramp(scheme$7);

  var scheme$8 = new Array(3).concat(
    "fc8d59ffffbf99d594",
    "d7191cfdae61abdda42b83ba",
    "d7191cfdae61ffffbfabdda42b83ba",
    "d53e4ffc8d59fee08be6f59899d5943288bd",
    "d53e4ffc8d59fee08bffffbfe6f59899d5943288bd",
    "d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd",
    "d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd",
    "9e0142d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd5e4fa2",
    "9e0142d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd5e4fa2"
  ).map(colors);

  ramp(scheme$8);

  var scheme$9 = new Array(3).concat(
    "e5f5f999d8c92ca25f",
    "edf8fbb2e2e266c2a4238b45",
    "edf8fbb2e2e266c2a42ca25f006d2c",
    "edf8fbccece699d8c966c2a42ca25f006d2c",
    "edf8fbccece699d8c966c2a441ae76238b45005824",
    "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824",
    "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b"
  ).map(colors);

  var BuGn = ramp(scheme$9);

  var scheme$a = new Array(3).concat(
    "e0ecf49ebcda8856a7",
    "edf8fbb3cde38c96c688419d",
    "edf8fbb3cde38c96c68856a7810f7c",
    "edf8fbbfd3e69ebcda8c96c68856a7810f7c",
    "edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b",
    "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b",
    "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b"
  ).map(colors);

  ramp(scheme$a);

  var scheme$b = new Array(3).concat(
    "e0f3dba8ddb543a2ca",
    "f0f9e8bae4bc7bccc42b8cbe",
    "f0f9e8bae4bc7bccc443a2ca0868ac",
    "f0f9e8ccebc5a8ddb57bccc443a2ca0868ac",
    "f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e",
    "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e",
    "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081"
  ).map(colors);

  ramp(scheme$b);

  var scheme$c = new Array(3).concat(
    "fee8c8fdbb84e34a33",
    "fef0d9fdcc8afc8d59d7301f",
    "fef0d9fdcc8afc8d59e34a33b30000",
    "fef0d9fdd49efdbb84fc8d59e34a33b30000",
    "fef0d9fdd49efdbb84fc8d59ef6548d7301f990000",
    "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000",
    "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000"
  ).map(colors);

  var OrRd = ramp(scheme$c);

  var scheme$d = new Array(3).concat(
    "ece2f0a6bddb1c9099",
    "f6eff7bdc9e167a9cf02818a",
    "f6eff7bdc9e167a9cf1c9099016c59",
    "f6eff7d0d1e6a6bddb67a9cf1c9099016c59",
    "f6eff7d0d1e6a6bddb67a9cf3690c002818a016450",
    "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450",
    "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636"
  ).map(colors);

  ramp(scheme$d);

  var scheme$e = new Array(3).concat(
    "ece7f2a6bddb2b8cbe",
    "f1eef6bdc9e174a9cf0570b0",
    "f1eef6bdc9e174a9cf2b8cbe045a8d",
    "f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d",
    "f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b",
    "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b",
    "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858"
  ).map(colors);

  var PuBu = ramp(scheme$e);

  var scheme$f = new Array(3).concat(
    "e7e1efc994c7dd1c77",
    "f1eef6d7b5d8df65b0ce1256",
    "f1eef6d7b5d8df65b0dd1c77980043",
    "f1eef6d4b9dac994c7df65b0dd1c77980043",
    "f1eef6d4b9dac994c7df65b0e7298ace125691003f",
    "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f",
    "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f"
  ).map(colors);

  ramp(scheme$f);

  var scheme$g = new Array(3).concat(
    "fde0ddfa9fb5c51b8a",
    "feebe2fbb4b9f768a1ae017e",
    "feebe2fbb4b9f768a1c51b8a7a0177",
    "feebe2fcc5c0fa9fb5f768a1c51b8a7a0177",
    "feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177",
    "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177",
    "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a"
  ).map(colors);

  ramp(scheme$g);

  var scheme$h = new Array(3).concat(
    "edf8b17fcdbb2c7fb8",
    "ffffcca1dab441b6c4225ea8",
    "ffffcca1dab441b6c42c7fb8253494",
    "ffffccc7e9b47fcdbb41b6c42c7fb8253494",
    "ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84",
    "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84",
    "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58"
  ).map(colors);

  var YlGnBu = ramp(scheme$h);

  var scheme$i = new Array(3).concat(
    "f7fcb9addd8e31a354",
    "ffffccc2e69978c679238443",
    "ffffccc2e69978c67931a354006837",
    "ffffccd9f0a3addd8e78c67931a354006837",
    "ffffccd9f0a3addd8e78c67941ab5d238443005a32",
    "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32",
    "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529"
  ).map(colors);

  ramp(scheme$i);

  var scheme$j = new Array(3).concat(
    "fff7bcfec44fd95f0e",
    "ffffd4fed98efe9929cc4c02",
    "ffffd4fed98efe9929d95f0e993404",
    "ffffd4fee391fec44ffe9929d95f0e993404",
    "ffffd4fee391fec44ffe9929ec7014cc4c028c2d04",
    "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04",
    "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506"
  ).map(colors);

  ramp(scheme$j);

  var scheme$k = new Array(3).concat(
    "ffeda0feb24cf03b20",
    "ffffb2fecc5cfd8d3ce31a1c",
    "ffffb2fecc5cfd8d3cf03b20bd0026",
    "ffffb2fed976feb24cfd8d3cf03b20bd0026",
    "ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026",
    "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026",
    "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026"
  ).map(colors);

  ramp(scheme$k);

  var scheme$l = new Array(3).concat(
    "deebf79ecae13182bd",
    "eff3ffbdd7e76baed62171b5",
    "eff3ffbdd7e76baed63182bd08519c",
    "eff3ffc6dbef9ecae16baed63182bd08519c",
    "eff3ffc6dbef9ecae16baed64292c62171b5084594",
    "f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594",
    "f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b"
  ).map(colors);

  var Blues = ramp(scheme$l);

  var scheme$m = new Array(3).concat(
    "e5f5e0a1d99b31a354",
    "edf8e9bae4b374c476238b45",
    "edf8e9bae4b374c47631a354006d2c",
    "edf8e9c7e9c0a1d99b74c47631a354006d2c",
    "edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32",
    "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32",
    "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b"
  ).map(colors);

  var Greens = ramp(scheme$m);

  var scheme$n = new Array(3).concat(
    "f0f0f0bdbdbd636363",
    "f7f7f7cccccc969696525252",
    "f7f7f7cccccc969696636363252525",
    "f7f7f7d9d9d9bdbdbd969696636363252525",
    "f7f7f7d9d9d9bdbdbd969696737373525252252525",
    "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525",
    "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000"
  ).map(colors);

  var Greys = ramp(scheme$n);

  var scheme$o = new Array(3).concat(
    "efedf5bcbddc756bb1",
    "f2f0f7cbc9e29e9ac86a51a3",
    "f2f0f7cbc9e29e9ac8756bb154278f",
    "f2f0f7dadaebbcbddc9e9ac8756bb154278f",
    "f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486",
    "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486",
    "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d"
  ).map(colors);

  var Purples = ramp(scheme$o);

  var scheme$p = new Array(3).concat(
    "fee0d2fc9272de2d26",
    "fee5d9fcae91fb6a4acb181d",
    "fee5d9fcae91fb6a4ade2d26a50f15",
    "fee5d9fcbba1fc9272fb6a4ade2d26a50f15",
    "fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d",
    "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d",
    "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d"
  ).map(colors);

  var Reds = ramp(scheme$p);

  var scheme$q = new Array(3).concat(
    "fee6cefdae6be6550d",
    "feeddefdbe85fd8d3cd94701",
    "feeddefdbe85fd8d3ce6550da63603",
    "feeddefdd0a2fdae6bfd8d3ce6550da63603",
    "feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04",
    "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04",
    "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704"
  ).map(colors);

  var Oranges = ramp(scheme$q);

  cubehelixLong(cubehelix(300, 0.5, 0.0), cubehelix(-240, 0.5, 1.0));

  var warm = cubehelixLong(cubehelix(-100, 0.75, 0.35), cubehelix(80, 1.50, 0.8));

  var cool = cubehelixLong(cubehelix(260, 0.75, 0.35), cubehelix(80, 1.50, 0.8));

  var c = cubehelix();

  var c$1 = rgb(),
      pi_1_3 = Math.PI / 3,
      pi_2_3 = Math.PI * 2 / 3;

  function ramp$1(range) {
    var n = range.length;
    return function(t) {
      return range[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
    };
  }

  ramp$1(colors("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));

  var magma = ramp$1(colors("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));

  var inferno = ramp$1(colors("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));

  var plasma = ramp$1(colors("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));

  /**
   * get a color interpolator
   * @param name {enum}: BuGn, OrRd....
   * @returns {*}
   */
  function getColorInterpolator(name){
      // reference: https://github.com/d3/d3-scale-chromatic/blob/master/README.md#sequential-multi-hue
      const interpolators = {
          BuGn: BuGn,
          OrRd: OrRd,
          PuBu: PuBu,
          YlGnBu: YlGnBu,
          Blues: Blues,
          Oranges: Oranges,
          Greens: Greens,
          Purples: Purples,
          Reds: Reds,
          Greys: Greys,
          Grays: Greys
      };
      if (!interpolators.hasOwnProperty(name)) {
          const err = "Color Interpolator Error " + name;
          console.error(err);
          throw(err);
      }
      return interpolators[name];

  }

  /**
   * reference: https://github.com/d3/d3-scale
   * reference: http://bl.ocks.org/curran/3094b37e63b918bab0a06787e161607b
   * scaleSequential maps the continuous domain to a continuous color scale
   * @param data {List} of numerical data
   * @param colors {String} a color name that is available in getColorInterpolator()
   */
  function setColorScale(data, colors="YlGnBu", dmin = 0) {
      // let dmax = Math.round(max(data));
      let dmax = max(data);
      const scale = sequential(getColorInterpolator(colors));
      scale.domain([dmin, dmax]);
      return scale;
  }

  /**
   * Draw a color legend bar.
   * Dependencies: expressionMap.css
   * @param title {String}
   * @param dom {object} D3 dom object
   * @param scale {Object} D3 scale of the color
   * @param config {Object} with attr: x, y
   * @param useLog {Boolean}
   * @param orientation {enum} h or v, i.e. horizontal or vertical
   * @param cell
   */
  function drawColorLegend(title, dom, scale, config, useLog, ticks$$1=10, base=10, cell={h:10, w:50}, orientation="h"){

      const data = [0].concat(scale.ticks(ticks$$1).slice(1)); // why doesn't this provide consistent number of ticks??


      // legend groups
      const legends = dom.append("g").attr("transform", `translate(${config.x}, ${config.y})`)
                      .selectAll(".legend").data(data);

      const g = legends.enter().append("g").classed("legend", true);

      if (orientation == 'h'){
           // legend title
          dom.append("text")
              .attr("class", "color-legend")
              .text(title)
              .attr("x", -10)
              .attr("text-anchor", "end")
              .attr("y", cell.h)
              .attr("transform", `translate(${config.x}, ${config.y})`);

          // the color legend
          g.append("rect")
              .attr("x", (d, i) => cell.w*i)
              .attr("y", 5)
              .attr("width", cell.w)
              .attr("height", cell.h)
              .style("fill", scale);

          g.append("text")
              .attr("class", "color-legend")
              .text((d) => useLog?(Math.pow(base, d)-1).toPrecision(2):d.toPrecision(2))
              .attr("x", (d, i) => cell.w * i)
              .attr("y", 0);
      } else {
           // legend title
          dom.append("text")
              .attr("class", "color-legend")
              .text(title)
              .attr("x", 5)
              .attr("text-anchor", "start")
              .attr("y", 0)
              .attr("transform", `translate(${config.x}, ${config.y + cell.h * data.length})rotate(90)`);

          g.append("rect")
              .attr("x", 0)
              .attr("y", (d, i) => cell.h*i)
              .attr("width", cell.w)
              .attr("height", cell.h)
              .style("fill", scale);

          g.append("text")
              .attr("class", "color-legend")
              .text((d) => useLog?(Math.pow(base, d)-1).toPrecision(2):d.toPrecision(2))
              .attr("x", 15)
              .attr("y", (d, i) => cell.h * i + (cell.h/2));
      }



  }

  /**
   * TODO: code review of how to preset parameter values
   * review all the position calculations
   */
  class DendroHeatmapConfig {
      /**
       * @param mainPanelW {Number}, set this to determine the cellW
       * @param leftPanelW {Integer}, set to 0 if there's no left panel
       * @param topPanelH {Integer}, set to 0 if there's no top panel
       * @param margin {Object} with attr: top, right, bottom, left, smaller values than the default are not recommended for the heatmap, top margin should be at least 50
       * @param cellH {Integer}
       * @param adjust {Integer}, adjusted spacing between the heatmap and the dendrogram
       */
      constructor(rootW=window.innerWidth, leftPanelW=100, topPanelH=100, margin={top:50, right:250, bottom:170, left:10}, cellH=12, adjust=10) {
          this.margin = margin;
          this.rootW = rootW;

          this.leftTreePanel = { // the row dendrogram panel
              x: margin.left,
              y: margin.top + topPanelH,
              h: undefined, // undefined initially, because it's data-dependent
              w: leftPanelW - adjust,
              id: "leftTree"
          };

          this.cell = {
              w: undefined, // to be calculated based on the data and rootW
              h: cellH
          };

          this.topTreePanel = { // the column dendrogram panel
              x: margin.left + leftPanelW,
              y: margin.top,
              h: topPanelH - adjust,
              w: this.rootW - (margin.left + leftPanelW + margin.right), // hard-coded values?
              id: "topTree"
          };

          this.heatmapPanel = {
              x: margin.left + leftPanelW,
              y: margin.top + topPanelH,
              h: this.leftTreePanel.h,
              w: this.topTreePanel.w,
              id: "heatmap"
          };

          this.legendPanel = { // the color legend panel
              x: margin.left + leftPanelW,
              y: 0,
              h: margin.top/2,
              w: this.topTreePanel.w,
              cell: {w: 60},
              id: "legend"
          };


      }

      get(){
          return {
              margin: this.margin,
              cell: this.cell,
              w: this.rootW,
              h: this.margin.top + this.topTreePanel.h + this.legendPanel.h + this.margin.bottom, // initial height
              panels: {
                  top: this.topTreePanel,
                  left: this.leftTreePanel,
                  main: this.heatmapPanel,
                  legend: this.legendPanel
              }
          };
      }
  }

  /**
   * Creates an SVG
   * @param id {String} a DOM element ID that starts with a "#"
   * @param width {Numeric}
   * @param height {Numeric}
   * @param margin {Object} with two attributes: width and height
   * @return {Selection} the d3 selection object of the SVG
   */

  /**
   *
   * @param id {String} the parent dom ID
   * @param width {Numeric}
   * @param height {Numeric}
   * @param margin {Object} with attr: left, top
   * @param svgId {String}
   * @returns {*}
   */
  function createSvg(id, width, height, margin, svgId=undefined){
      if (svgId===undefined) svgId=`${id}-svg`;
      return select("#"+id).append("svg")
          .attr("width", width)
          .attr("height", height)
          .attr("id", svgId)
          .append("g")
          .attr("transform", `translate(${margin.left}, ${margin.top})`)
  }
  /**
   * A function for parsing the CSS style sheet and including the style properties in the downloadable SVG.
   * @param dom
   * @returns {Element}
   */
  function parseCssStyles (dom) {
      var used = "";
      var sheets = document.styleSheets;

      for (var i = 0; i < sheets.length; i++) { // TODO: walk through this block of code

          try {
              if (sheets[i].cssRules == null) continue;
              var rules = sheets[i].cssRules;

              for (var j = 0; j < rules.length; j++) {
                  var rule = rules[j];
                  if (typeof(rule.style) != "undefined") {
                      var elems;
                      //Some selectors won't work, and most of these don't matter.
                      try {
                          elems = $(dom).find(rule.selectorText);
                      } catch (e) {
                          elems = [];
                      }

                      if (elems.length > 0) {
                          used += rule.selectorText + " { " + rule.style.cssText + " }\n";
                      }
                  }
              }
          } catch (e) {
              // In Firefox, if stylesheet originates from a diff domain,
              // trying to access the cssRules will throw a SecurityError.
              // Hence, we must use a try/catch to handle this in Firefox
              if (e.name !== 'SecurityError') throw e;
              continue;
          }
      }

      var s = document.createElement('style');
      s.setAttribute('type', 'text/css');
      s.innerHTML = "<![CDATA[\n" + used + "\n]]>";

      return s;
  }

  function count(node) {
    var sum = 0,
        children = node.children,
        i = children && children.length;
    if (!i) sum = 1;
    else while (--i >= 0) sum += children[i].value;
    node.value = sum;
  }

  function node_count() {
    return this.eachAfter(count);
  }

  function node_each(callback) {
    var node = this, current, next = [node], children, i, n;
    do {
      current = next.reverse(), next = [];
      while (node = current.pop()) {
        callback(node), children = node.children;
        if (children) for (i = 0, n = children.length; i < n; ++i) {
          next.push(children[i]);
        }
      }
    } while (next.length);
    return this;
  }

  function node_eachBefore(callback) {
    var node = this, nodes = [node], children, i;
    while (node = nodes.pop()) {
      callback(node), children = node.children;
      if (children) for (i = children.length - 1; i >= 0; --i) {
        nodes.push(children[i]);
      }
    }
    return this;
  }

  function node_eachAfter(callback) {
    var node = this, nodes = [node], next = [], children, i, n;
    while (node = nodes.pop()) {
      next.push(node), children = node.children;
      if (children) for (i = 0, n = children.length; i < n; ++i) {
        nodes.push(children[i]);
      }
    }
    while (node = next.pop()) {
      callback(node);
    }
    return this;
  }

  function node_sum(value) {
    return this.eachAfter(function(node) {
      var sum = +value(node.data) || 0,
          children = node.children,
          i = children && children.length;
      while (--i >= 0) sum += children[i].value;
      node.value = sum;
    });
  }

  function node_sort(compare) {
    return this.eachBefore(function(node) {
      if (node.children) {
        node.children.sort(compare);
      }
    });
  }

  function node_path(end) {
    var start = this,
        ancestor = leastCommonAncestor(start, end),
        nodes = [start];
    while (start !== ancestor) {
      start = start.parent;
      nodes.push(start);
    }
    var k = nodes.length;
    while (end !== ancestor) {
      nodes.splice(k, 0, end);
      end = end.parent;
    }
    return nodes;
  }

  function leastCommonAncestor(a, b) {
    if (a === b) return a;
    var aNodes = a.ancestors(),
        bNodes = b.ancestors(),
        c = null;
    a = aNodes.pop();
    b = bNodes.pop();
    while (a === b) {
      c = a;
      a = aNodes.pop();
      b = bNodes.pop();
    }
    return c;
  }

  function node_ancestors() {
    var node = this, nodes = [node];
    while (node = node.parent) {
      nodes.push(node);
    }
    return nodes;
  }

  function node_descendants() {
    var nodes = [];
    this.each(function(node) {
      nodes.push(node);
    });
    return nodes;
  }

  function node_leaves() {
    var leaves = [];
    this.eachBefore(function(node) {
      if (!node.children) {
        leaves.push(node);
      }
    });
    return leaves;
  }

  function node_links() {
    var root = this, links = [];
    root.each(function(node) {
      if (node !== root) { // Don’t include the root’s parent, if any.
        links.push({source: node.parent, target: node});
      }
    });
    return links;
  }

  function hierarchy(data, children) {
    var root = new Node(data),
        valued = +data.value && (root.value = data.value),
        node,
        nodes = [root],
        child,
        childs,
        i,
        n;

    if (children == null) children = defaultChildren;

    while (node = nodes.pop()) {
      if (valued) node.value = +node.data.value;
      if ((childs = children(node.data)) && (n = childs.length)) {
        node.children = new Array(n);
        for (i = n - 1; i >= 0; --i) {
          nodes.push(child = node.children[i] = new Node(childs[i]));
          child.parent = node;
          child.depth = node.depth + 1;
        }
      }
    }

    return root.eachBefore(computeHeight);
  }

  function node_copy() {
    return hierarchy(this).eachBefore(copyData);
  }

  function defaultChildren(d) {
    return d.children;
  }

  function copyData(node) {
    node.data = node.data.data;
  }

  function computeHeight(node) {
    var height = 0;
    do node.height = height;
    while ((node = node.parent) && (node.height < ++height));
  }

  function Node(data) {
    this.data = data;
    this.depth =
    this.height = 0;
    this.parent = null;
  }

  Node.prototype = hierarchy.prototype = {
    constructor: Node,
    count: node_count,
    each: node_each,
    eachAfter: node_eachAfter,
    eachBefore: node_eachBefore,
    sum: node_sum,
    sort: node_sort,
    path: node_path,
    ancestors: node_ancestors,
    descendants: node_descendants,
    leaves: node_leaves,
    links: node_links,
    copy: node_copy
  };

  var slice$4 = Array.prototype.slice;

  function identity$4(x) {
    return x;
  }

  var top$1 = 1,
      right = 2,
      bottom = 3,
      left = 4,
      epsilon = 1e-6;

  function translateX(x) {
    return "translate(" + (x + 0.5) + ",0)";
  }

  function translateY(y) {
    return "translate(0," + (y + 0.5) + ")";
  }

  function number$4(scale) {
    return function(d) {
      return +scale(d);
    };
  }

  function center(scale) {
    var offset = Math.max(0, scale.bandwidth() - 1) / 2; // Adjust for 0.5px offset.
    if (scale.round()) offset = Math.round(offset);
    return function(d) {
      return +scale(d) + offset;
    };
  }

  function entering() {
    return !this.__axis;
  }

  function axis(orient, scale) {
    var tickArguments = [],
        tickValues = null,
        tickFormat = null,
        tickSizeInner = 6,
        tickSizeOuter = 6,
        tickPadding = 3,
        k = orient === top$1 || orient === left ? -1 : 1,
        x = orient === left || orient === right ? "x" : "y",
        transform = orient === top$1 || orient === bottom ? translateX : translateY;

    function axis(context) {
      var values = tickValues == null ? (scale.ticks ? scale.ticks.apply(scale, tickArguments) : scale.domain()) : tickValues,
          format = tickFormat == null ? (scale.tickFormat ? scale.tickFormat.apply(scale, tickArguments) : identity$4) : tickFormat,
          spacing = Math.max(tickSizeInner, 0) + tickPadding,
          range = scale.range(),
          range0 = +range[0] + 0.5,
          range1 = +range[range.length - 1] + 0.5,
          position = (scale.bandwidth ? center : number$4)(scale.copy()),
          selection = context.selection ? context.selection() : context,
          path = selection.selectAll(".domain").data([null]),
          tick = selection.selectAll(".tick").data(values, scale).order(),
          tickExit = tick.exit(),
          tickEnter = tick.enter().append("g").attr("class", "tick"),
          line = tick.select("line"),
          text = tick.select("text");

      path = path.merge(path.enter().insert("path", ".tick")
          .attr("class", "domain")
          .attr("stroke", "#000"));

      tick = tick.merge(tickEnter);

      line = line.merge(tickEnter.append("line")
          .attr("stroke", "#000")
          .attr(x + "2", k * tickSizeInner));

      text = text.merge(tickEnter.append("text")
          .attr("fill", "#000")
          .attr(x, k * spacing)
          .attr("dy", orient === top$1 ? "0em" : orient === bottom ? "0.71em" : "0.32em"));

      if (context !== selection) {
        path = path.transition(context);
        tick = tick.transition(context);
        line = line.transition(context);
        text = text.transition(context);

        tickExit = tickExit.transition(context)
            .attr("opacity", epsilon)
            .attr("transform", function(d) { return isFinite(d = position(d)) ? transform(d) : this.getAttribute("transform"); });

        tickEnter
            .attr("opacity", epsilon)
            .attr("transform", function(d) { var p = this.parentNode.__axis; return transform(p && isFinite(p = p(d)) ? p : position(d)); });
      }

      tickExit.remove();

      path
          .attr("d", orient === left || orient == right
              ? "M" + k * tickSizeOuter + "," + range0 + "H0.5V" + range1 + "H" + k * tickSizeOuter
              : "M" + range0 + "," + k * tickSizeOuter + "V0.5H" + range1 + "V" + k * tickSizeOuter);

      tick
          .attr("opacity", 1)
          .attr("transform", function(d) { return transform(position(d)); });

      line
          .attr(x + "2", k * tickSizeInner);

      text
          .attr(x, k * spacing)
          .text(format);

      selection.filter(entering)
          .attr("fill", "none")
          .attr("font-size", 10)
          .attr("font-family", "sans-serif")
          .attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");

      selection
          .each(function() { this.__axis = position; });
    }

    axis.scale = function(_) {
      return arguments.length ? (scale = _, axis) : scale;
    };

    axis.ticks = function() {
      return tickArguments = slice$4.call(arguments), axis;
    };

    axis.tickArguments = function(_) {
      return arguments.length ? (tickArguments = _ == null ? [] : slice$4.call(_), axis) : tickArguments.slice();
    };

    axis.tickValues = function(_) {
      return arguments.length ? (tickValues = _ == null ? null : slice$4.call(_), axis) : tickValues && tickValues.slice();
    };

    axis.tickFormat = function(_) {
      return arguments.length ? (tickFormat = _, axis) : tickFormat;
    };

    axis.tickSize = function(_) {
      return arguments.length ? (tickSizeInner = tickSizeOuter = +_, axis) : tickSizeInner;
    };

    axis.tickSizeInner = function(_) {
      return arguments.length ? (tickSizeInner = +_, axis) : tickSizeInner;
    };

    axis.tickSizeOuter = function(_) {
      return arguments.length ? (tickSizeOuter = +_, axis) : tickSizeOuter;
    };

    axis.tickPadding = function(_) {
      return arguments.length ? (tickPadding = +_, axis) : tickPadding;
    };

    return axis;
  }

  function axisTop(scale) {
    return axis(top$1, scale);
  }

  function axisRight(scale) {
    return axis(right, scale);
  }

  function axisBottom(scale) {
    return axis(bottom, scale);
  }

  function axisLeft(scale) {
    return axis(left, scale);
  }

  // Copyright 2011 Jason Davies https://github.com/jasondavies/newick.js

  function parseNewick(s) {
      var ancestors = [];
      var tree = {};
      var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);
      for (var i=0; i<tokens.length; i++) {
        var token = tokens[i];
        switch (token) {
          case '(': // new branchset
            var subtree = {};
            tree.branchset = [subtree];
            ancestors.push(tree);
            tree = subtree;
            break;
          case ',': // another branch
            var subtree = {};
            ancestors[ancestors.length-1].branchset.push(subtree);
            tree = subtree;
            break;
          case ')': // optional name next
            tree = ancestors.pop();
            break;
          case ':': // optional length next
            break;
          default:
            var x = tokens[i-1];
            if (x == ')' || x == '(' || x == ',') {
              tree.name = token;
            } else if (x == ':') {
              tree.length = parseFloat(token);
            }
        }
      }
      return tree;
  }

  /*
      Dendrogram visualizes a text-based Newick tree using D3 V5.

      dependencies:
      d3 v5
      the newick parser: newick.js

      references:
      https://github.com/d3/d3-hierarchy
      https://github.com/jasondavies/newick.js/

      notes on the underlying data structures:
      - it uses parseNewick() to convert the newick tree into the following json:
          {
              branchset:[child node json objects],
              name: "" // internal nodes would have no real labels
          }
         This json structure is the input data of d3.hierarchy()

      - In the d3.hierarchy(), the root node object has the following structure:
          {
              children: [co, co],
              data: {
                  branchset: Array(2),
                  name: "node name"
              },
              depth: 0,
              height: integer,
              parent: null,
              value: 9
          }
   */
  class Dendrogram {
      constructor(newick, orientation='h'){
          this.newick = newick;
          this.orientation = orientation;
          this.postorder = [];
          this.root = hierarchy(parseNewick(newick), (d) => d.branchset)
              .sum((d)=>d.branchset?0:1)
              .sort((a,b)=>a.value-b.value||a.data.length-b.data.length);
          this.leaves = this.root.leaves().sort((a, b) => (a.value - b.value) || ascending$1(a.data.length, b.data.length));
          this.width = undefined;
          this.height = undefined;
          this.xScale = undefined;
          this.yScale = undefined;
      }

      draw(dom, width, height){
          this.width = width;
          this.height = height;
          this._setXScale();
          this._setYScale();
          if ('h' == this.orientation) this._drawHTree(dom);
          else this._drawVTree(dom);
      }

      /////// private methods ///////

      _drawHTree(dom){
          const setY = (node) => {
              if (node.children === undefined) {
                  // a leaf node
                  node.y = this.yScale(node.data.name);
              } else {
                  // an internal node
                  // the y coordinate of an internal node is the average y from its children
                  node.y = node.children.reduce((sum$$1, d)=>sum$$1+d.y, 0)/node.children.length;
              }
          };
          const setX = (node) => {
              node.x = this.xScale(this._getBranchLengthToRoot(node));
          };

          // from the leaf level -> root
          const nodes = this._sortNodesByLevel();
          nodes.forEach((node) => {
              setX(node);
              setY(node);
          });

          dom.selectAll('.branch')
              .data(nodes)
              .enter().append("line")
              .attr("x1", (d) => d.x)
              .attr("x2", (d) => d.data.length?d.x - this.xScale(d.data.length):d.x)
              .attr("y1", (d) => d.y + this.yScale.bandwidth()/2)
              .attr("y2", (d) => d.y + this.yScale.bandwidth()/2)
              .attr("stroke", "gray")
              .attr("stroke-width", 1);

          // for all internal nodes
          const inodes = this.root.descendants().filter((d)=>d.height).sort((a,b)=>b.height-a.height);
          dom.selectAll('.arm')
              .data(inodes)
              .enter().append("line")
              .attr("x1", (d) => d.x)
              .attr("x2", (d) => d.x)
              .attr("y1", (d) => d.children[0].y + this.yScale.bandwidth()/2)
              .attr("y2", (d) => d.children[1].y + this.yScale.bandwidth()/2)
              .attr("stroke", "gray")
              .attr("stroke-width", 1);

          dom.selectAll('.node')
              .data(inodes)
              .enter().append("circle")
              .attr("cx", (d) => d.x)
              .attr("cy", (d) => d.y + this.yScale.bandwidth()/2)
              .attr("r", 2)
              .attr('fill', '#333')
              .attr("opacity", 0.5)
              .attr("class", "dendrogram-node")
              .on("mouseover", function(d){
                  d3.select(this).attr("r", 3);
                  console.log(d.leaves());
              })
              .on("mouseout", function(d){
                  d3.select(this).attr("r", 2);
              });

          // axis
          // Add the x Axis
          dom.append("g")
              .attr("class", "dendrogram-axis")
              .attr("transform", "translate(0," + this.height + ")")
              .call(
                  axisBottom(this.xScale)
                      .ticks(3)
                  // .tickValues([Math.floor(this._getMaxBranchLength()/2), Math.floor(this._getMaxBranchLength())])
              );
      }

      _sortNodesByLevel(){
          // returns a list of nodes ordered by ancestral level, then by branch length
          return this.root.descendants().sort((a, b) => (a.height - b.height) || ascending$1(a.data.length, b.data.length));
      }

      _drawVTree(dom){
          const setX = (node) => {
              if (node.children === undefined) {
                  // a leaf node
                  node.x = this.xScale(node.data.name);
              } else {
                  // an internal node
                  // the y coordinate of an internal node is the average y from its children
                  node.x = node.children.reduce((sum$$1, d)=>sum$$1+d.x, 0)/node.children.length;
              }
          };
          const setY = (node) => {
              node.y = this.yScale(this._getBranchLengthToRoot(node));
          };
          // from the leaf level -> root
          const nodes = this._sortNodesByLevel();
          nodes.forEach((node) => {
              setX(node);
              setY(node);
          });
          dom.selectAll('.branch')
              .data(nodes)
              .enter().append("line")
              .attr("y1", (d) => d.y)
              .attr("y2", (d) => d.data.length?d.y - this.yScale(d.data.length):d.y)
              .attr("x1", (d) => d.x + this.xScale.bandwidth()/2)
              .attr("x2", (d) => d.x + this.xScale.bandwidth()/2)
              .attr("stroke", "gray")
              .attr("stroke-width", 1);

          // for all internal nodes
          const inodes = this.root.descendants().filter((d)=>d.height).sort((a,b)=>b.height-a.height);
          dom.selectAll('.arm')
              .data(inodes)
              .enter().append("line")
              .attr("y1", (d) => d.y)
              .attr("y2", (d) => d.y)
              .attr("x1", (d) => d.children[0].x + this.xScale.bandwidth()/2)
              .attr("x2", (d) => d.children[1].x + this.xScale.bandwidth()/2)
              .attr("stroke", "gray")
              .attr("stroke-width", 1);

          dom.selectAll('.node')
              .data(inodes)
              .enter().append("circle")
              .attr("cx", (d) => d.x + this.xScale.bandwidth()/2)
              .attr("cy", (d) => d.y)
              .attr("r", 2)
              .attr('fill', '#333')
              .attr("opacity", 0.5)
              .attr("class", "dendrogram-node")
              .on("mouseover", function(d){
                  d3.select(this).attr("r", 3);
                  console.log(d.leaves());
              })
              .on("mouseout", function(d){
                  d3.select(this).attr("r", 2);
              });

          // axis
          // Add the x Axis
          dom.append("g")
              // .attr("transform", `translate(${this.width}, 0)`)
              .attr("class", "dendrogram-axis")
              .call(
                  axisLeft(this.yScale)
                      .ticks(3)
                  // .tickValues([Math.floor(this._getMaxBranchLength()/2), Math.floor(this._getMaxBranchLength())])
              );

      }

      _getBranchLengthToRoot(node) {
          // node: a d3.hierarchy node
          return node.path(this.root)
              .reduce((sum$$1, d) => d.data.length?sum$$1+d.data.length:sum$$1, 0);
      }

      _getMaxBranchLength() {
          // the assumption here is that all leaf nodes have the same distance to the root.
          let node = this.leaves[0]; // randomly picks a leaf node
          return this._getBranchLengthToRoot(node);
      }

      _assignPostorder(node){
          // assigns post-order of all leaf nodes
          if(node.children === undefined){
              // base case
              this.postorder.push(node);
              return;
          } else {
              this._assignPostorder(node.children[0]);
              this._assignPostorder(node.children[1]);
              return;
          }
      }

      _setXScale(){
          if ('h' == this.orientation){
              this.xScale = linear$1()
                  .domain([0, this._getMaxBranchLength()])
                  .range([0, this.width]);
          } else {
              this._assignPostorder(this.root);
              this.xScale = band()
                  .domain(this.postorder.map((d) => d.data.name))
                  .range([0, this.width])
                  .padding(.05);
          }
      }

      _setYScale(){
          if ('h' == this.orientation){
              this._assignPostorder(this.root);
              this.yScale = band()
                  .domain(this.postorder.map((d) => d.data.name))
                  .range([0, this.height])
                  .padding(.05);
          } else {
              this.yScale = linear$1()
                  .domain([0, this._getMaxBranchLength()])
                  .range([0, this.height]);
          }
      }

  }

  var noop = {value: function() {}};

  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || (t in _)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }

  function Dispatch(_) {
    this._ = _;
  }

  function parseTypenames$1(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return {type: t, name: name};
    });
  }

  Dispatch.prototype = dispatch.prototype = {
    constructor: Dispatch,
    on: function(typename, callback) {
      var _ = this._,
          T = parseTypenames$1(typename + "", _),
          t,
          i = -1,
          n = T.length;

      // If no callback was specified, return the callback of the given type and name.
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
        return;
      }

      // If a type was specified, set the callback for the given type and name.
      // Otherwise, if a null callback was specified, remove callbacks of the given name.
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
      }

      return this;
    },
    copy: function() {
      var copy = {}, _ = this._;
      for (var t in _) copy[t] = _[t].slice();
      return new Dispatch(copy);
    },
    call: function(type, that) {
      if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    },
    apply: function(type, that, args) {
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    }
  };

  function get(type, name) {
    for (var i = 0, n = type.length, c; i < n; ++i) {
      if ((c = type[i]).name === name) {
        return c.value;
      }
    }
  }

  function set$1(type, name, callback) {
    for (var i = 0, n = type.length; i < n; ++i) {
      if (type[i].name === name) {
        type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
        break;
      }
    }
    if (callback != null) type.push({name: name, value: callback});
    return type;
  }

  var frame = 0, // is an animation frame pending?
      timeout = 0, // is a timeout pending?
      interval = 0, // are any timers active?
      pokeDelay = 1000, // how frequently we check for clock skew
      taskHead,
      taskTail,
      clockLast = 0,
      clockNow = 0,
      clockSkew = 0,
      clock = typeof performance === "object" && performance.now ? performance : Date,
      setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

  function now() {
    return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
  }

  function clearNow() {
    clockNow = 0;
  }

  function Timer() {
    this._call =
    this._time =
    this._next = null;
  }

  Timer.prototype = timer.prototype = {
    constructor: Timer,
    restart: function(callback, delay, time) {
      if (typeof callback !== "function") throw new TypeError("callback is not a function");
      time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
      if (!this._next && taskTail !== this) {
        if (taskTail) taskTail._next = this;
        else taskHead = this;
        taskTail = this;
      }
      this._call = callback;
      this._time = time;
      sleep();
    },
    stop: function() {
      if (this._call) {
        this._call = null;
        this._time = Infinity;
        sleep();
      }
    }
  };

  function timer(callback, delay, time) {
    var t = new Timer;
    t.restart(callback, delay, time);
    return t;
  }

  function timerFlush() {
    now(); // Get the current time, if not already set.
    ++frame; // Pretend we’ve set an alarm, if we haven’t already.
    var t = taskHead, e;
    while (t) {
      if ((e = clockNow - t._time) >= 0) t._call.call(null, e);
      t = t._next;
    }
    --frame;
  }

  function wake() {
    clockNow = (clockLast = clock.now()) + clockSkew;
    frame = timeout = 0;
    try {
      timerFlush();
    } finally {
      frame = 0;
      nap();
      clockNow = 0;
    }
  }

  function poke() {
    var now = clock.now(), delay = now - clockLast;
    if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
  }

  function nap() {
    var t0, t1 = taskHead, t2, time = Infinity;
    while (t1) {
      if (t1._call) {
        if (time > t1._time) time = t1._time;
        t0 = t1, t1 = t1._next;
      } else {
        t2 = t1._next, t1._next = null;
        t1 = t0 ? t0._next = t2 : taskHead = t2;
      }
    }
    taskTail = t0;
    sleep(time);
  }

  function sleep(time) {
    if (frame) return; // Soonest alarm already set, or will be.
    if (timeout) timeout = clearTimeout(timeout);
    var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
    if (delay > 24) {
      if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
      if (interval) interval = clearInterval(interval);
    } else {
      if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }

  function timeout$1(callback, delay, time) {
    var t = new Timer;
    delay = delay == null ? 0 : +delay;
    t.restart(function(elapsed) {
      t.stop();
      callback(elapsed + delay);
    }, delay, time);
    return t;
  }

  var emptyOn = dispatch("start", "end", "interrupt");
  var emptyTween = [];

  var CREATED = 0;
  var SCHEDULED = 1;
  var STARTING = 2;
  var STARTED = 3;
  var RUNNING = 4;
  var ENDING = 5;
  var ENDED = 6;

  function schedule(node, name, id, index, group, timing) {
    var schedules = node.__transition;
    if (!schedules) node.__transition = {};
    else if (id in schedules) return;
    create$1(node, id, {
      name: name,
      index: index, // For context during callback.
      group: group, // For context during callback.
      on: emptyOn,
      tween: emptyTween,
      time: timing.time,
      delay: timing.delay,
      duration: timing.duration,
      ease: timing.ease,
      timer: null,
      state: CREATED
    });
  }

  function init(node, id) {
    var schedule = get$1(node, id);
    if (schedule.state > CREATED) throw new Error("too late; already scheduled");
    return schedule;
  }

  function set$2(node, id) {
    var schedule = get$1(node, id);
    if (schedule.state > STARTING) throw new Error("too late; already started");
    return schedule;
  }

  function get$1(node, id) {
    var schedule = node.__transition;
    if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
    return schedule;
  }

  function create$1(node, id, self) {
    var schedules = node.__transition,
        tween;

    // Initialize the self timer when the transition is created.
    // Note the actual delay is not known until the first callback!
    schedules[id] = self;
    self.timer = timer(schedule, 0, self.time);

    function schedule(elapsed) {
      self.state = SCHEDULED;
      self.timer.restart(start, self.delay, self.time);

      // If the elapsed delay is less than our first sleep, start immediately.
      if (self.delay <= elapsed) start(elapsed - self.delay);
    }

    function start(elapsed) {
      var i, j, n, o;

      // If the state is not SCHEDULED, then we previously errored on start.
      if (self.state !== SCHEDULED) return stop();

      for (i in schedules) {
        o = schedules[i];
        if (o.name !== self.name) continue;

        // While this element already has a starting transition during this frame,
        // defer starting an interrupting transition until that transition has a
        // chance to tick (and possibly end); see d3/d3-transition#54!
        if (o.state === STARTED) return timeout$1(start);

        // Interrupt the active transition, if any.
        // Dispatch the interrupt event.
        if (o.state === RUNNING) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("interrupt", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }

        // Cancel any pre-empted transitions. No interrupt event is dispatched
        // because the cancelled transitions never started. Note that this also
        // removes this transition from the pending list!
        else if (+i < id) {
          o.state = ENDED;
          o.timer.stop();
          delete schedules[i];
        }
      }

      // Defer the first tick to end of the current frame; see d3/d3#1576.
      // Note the transition may be canceled after start and before the first tick!
      // Note this must be scheduled before the start event; see d3/d3-transition#16!
      // Assuming this is successful, subsequent callbacks go straight to tick.
      timeout$1(function() {
        if (self.state === STARTED) {
          self.state = RUNNING;
          self.timer.restart(tick, self.delay, self.time);
          tick(elapsed);
        }
      });

      // Dispatch the start event.
      // Note this must be done before the tween are initialized.
      self.state = STARTING;
      self.on.call("start", node, node.__data__, self.index, self.group);
      if (self.state !== STARTING) return; // interrupted
      self.state = STARTED;

      // Initialize the tween, deleting null tween.
      tween = new Array(n = self.tween.length);
      for (i = 0, j = -1; i < n; ++i) {
        if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
          tween[++j] = o;
        }
      }
      tween.length = j + 1;
    }

    function tick(elapsed) {
      var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
          i = -1,
          n = tween.length;

      while (++i < n) {
        tween[i].call(null, t);
      }

      // Dispatch the end event.
      if (self.state === ENDING) {
        self.on.call("end", node, node.__data__, self.index, self.group);
        stop();
      }
    }

    function stop() {
      self.state = ENDED;
      self.timer.stop();
      delete schedules[id];
      for (var i in schedules) return; // eslint-disable-line no-unused-vars
      delete node.__transition;
    }
  }

  function interrupt(node, name) {
    var schedules = node.__transition,
        schedule$$1,
        active,
        empty = true,
        i;

    if (!schedules) return;

    name = name == null ? null : name + "";

    for (i in schedules) {
      if ((schedule$$1 = schedules[i]).name !== name) { empty = false; continue; }
      active = schedule$$1.state > STARTING && schedule$$1.state < ENDING;
      schedule$$1.state = ENDED;
      schedule$$1.timer.stop();
      if (active) schedule$$1.on.call("interrupt", node, node.__data__, schedule$$1.index, schedule$$1.group);
      delete schedules[i];
    }

    if (empty) delete node.__transition;
  }

  function selection_interrupt(name) {
    return this.each(function() {
      interrupt(this, name);
    });
  }

  function tweenRemove(id, name) {
    var tween0, tween1;
    return function() {
      var schedule$$1 = set$2(this, id),
          tween = schedule$$1.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = tween0 = tween;
        for (var i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1 = tween1.slice();
            tween1.splice(i, 1);
            break;
          }
        }
      }

      schedule$$1.tween = tween1;
    };
  }

  function tweenFunction(id, name, value) {
    var tween0, tween1;
    if (typeof value !== "function") throw new Error;
    return function() {
      var schedule$$1 = set$2(this, id),
          tween = schedule$$1.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = (tween0 = tween).slice();
        for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1[i] = t;
            break;
          }
        }
        if (i === n) tween1.push(t);
      }

      schedule$$1.tween = tween1;
    };
  }

  function transition_tween(name, value) {
    var id = this._id;

    name += "";

    if (arguments.length < 2) {
      var tween = get$1(this.node(), id).tween;
      for (var i = 0, n = tween.length, t; i < n; ++i) {
        if ((t = tween[i]).name === name) {
          return t.value;
        }
      }
      return null;
    }

    return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
  }

  function tweenValue(transition, name, value) {
    var id = transition._id;

    transition.each(function() {
      var schedule$$1 = set$2(this, id);
      (schedule$$1.value || (schedule$$1.value = {}))[name] = value.apply(this, arguments);
    });

    return function(node) {
      return get$1(node, id).value[name];
    };
  }

  function interpolate(a, b) {
    var c;
    return (typeof b === "number" ? number$1
        : b instanceof color ? rgb$1
        : (c = color(b)) ? (b = c, rgb$1)
        : string)(a, b);
  }

  function attrRemove$1(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS$1(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant$1(name, interpolate$$1, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = this.getAttribute(name);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value1);
    };
  }

  function attrConstantNS$1(fullname, interpolate$$1, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = this.getAttributeNS(fullname.space, fullname.local);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value1);
    };
  }

  function attrFunction$1(name, interpolate$$1, value$$1) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0, value1 = value$$1(this);
      if (value1 == null) return void this.removeAttribute(name);
      value0 = this.getAttribute(name);
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value10 = value1);
    };
  }

  function attrFunctionNS$1(fullname, interpolate$$1, value$$1) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0, value1 = value$$1(this);
      if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
      value0 = this.getAttributeNS(fullname.space, fullname.local);
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value10 = value1);
    };
  }

  function transition_attr(name, value$$1) {
    var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
    return this.attrTween(name, typeof value$$1 === "function"
        ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)(fullname, i, tweenValue(this, "attr." + name, value$$1))
        : value$$1 == null ? (fullname.local ? attrRemoveNS$1 : attrRemove$1)(fullname)
        : (fullname.local ? attrConstantNS$1 : attrConstant$1)(fullname, i, value$$1 + ""));
  }

  function attrTweenNS(fullname, value) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.setAttributeNS(fullname.space, fullname.local, i(t));
      };
    }
    tween._value = value;
    return tween;
  }

  function attrTween(name, value) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.setAttribute(name, i(t));
      };
    }
    tween._value = value;
    return tween;
  }

  function transition_attrTween(name, value) {
    var key = "attr." + name;
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    var fullname = namespace(name);
    return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
  }

  function delayFunction(id, value) {
    return function() {
      init(this, id).delay = +value.apply(this, arguments);
    };
  }

  function delayConstant(id, value) {
    return value = +value, function() {
      init(this, id).delay = value;
    };
  }

  function transition_delay(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? delayFunction
            : delayConstant)(id, value))
        : get$1(this.node(), id).delay;
  }

  function durationFunction(id, value) {
    return function() {
      set$2(this, id).duration = +value.apply(this, arguments);
    };
  }

  function durationConstant(id, value) {
    return value = +value, function() {
      set$2(this, id).duration = value;
    };
  }

  function transition_duration(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? durationFunction
            : durationConstant)(id, value))
        : get$1(this.node(), id).duration;
  }

  function easeConstant(id, value) {
    if (typeof value !== "function") throw new Error;
    return function() {
      set$2(this, id).ease = value;
    };
  }

  function transition_ease(value) {
    var id = this._id;

    return arguments.length
        ? this.each(easeConstant(id, value))
        : get$1(this.node(), id).ease;
  }

  function transition_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Transition(subgroups, this._parents, this._name, this._id);
  }

  function transition_merge(transition$$1) {
    if (transition$$1._id !== this._id) throw new Error;

    for (var groups0 = this._groups, groups1 = transition$$1._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Transition(merges, this._parents, this._name, this._id);
  }

  function start(name) {
    return (name + "").trim().split(/^|\s+/).every(function(t) {
      var i = t.indexOf(".");
      if (i >= 0) t = t.slice(0, i);
      return !t || t === "start";
    });
  }

  function onFunction(id, name, listener) {
    var on0, on1, sit = start(name) ? init : set$2;
    return function() {
      var schedule$$1 = sit(this, id),
          on = schedule$$1.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

      schedule$$1.on = on1;
    };
  }

  function transition_on(name, listener) {
    var id = this._id;

    return arguments.length < 2
        ? get$1(this.node(), id).on.on(name)
        : this.each(onFunction(id, name, listener));
  }

  function removeFunction(id) {
    return function() {
      var parent = this.parentNode;
      for (var i in this.__transition) if (+i !== id) return;
      if (parent) parent.removeChild(this);
    };
  }

  function transition_remove() {
    return this.on("end.remove", removeFunction(this._id));
  }

  function transition_select(select$$1) {
    var name = this._name,
        id = this._id;

    if (typeof select$$1 !== "function") select$$1 = selector(select$$1);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select$$1.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
          schedule(subgroup[i], name, id, i, subgroup, get$1(node, id));
        }
      }
    }

    return new Transition(subgroups, this._parents, name, id);
  }

  function transition_selectAll(select$$1) {
    var name = this._name,
        id = this._id;

    if (typeof select$$1 !== "function") select$$1 = selectorAll(select$$1);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          for (var children = select$$1.call(node, node.__data__, i, group), child, inherit = get$1(node, id), k = 0, l = children.length; k < l; ++k) {
            if (child = children[k]) {
              schedule(child, name, id, k, children, inherit);
            }
          }
          subgroups.push(children);
          parents.push(node);
        }
      }
    }

    return new Transition(subgroups, parents, name, id);
  }

  var Selection$1 = selection.prototype.constructor;

  function transition_selection() {
    return new Selection$1(this._groups, this._parents);
  }

  function styleRemove$1(name, interpolate$$1) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name),
          value1 = (this.style.removeProperty(name), styleValue(this, name));
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value10 = value1);
    };
  }

  function styleRemoveEnd(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant$1(name, interpolate$$1, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value1);
    };
  }

  function styleFunction$1(name, interpolate$$1, value$$1) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name),
          value1 = value$$1(this);
      if (value1 == null) value1 = (this.style.removeProperty(name), styleValue(this, name));
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate$$1(value00 = value0, value10 = value1);
    };
  }

  function transition_style(name, value$$1, priority) {
    var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
    return value$$1 == null ? this
            .styleTween(name, styleRemove$1(name, i))
            .on("end.style." + name, styleRemoveEnd(name))
        : this.styleTween(name, typeof value$$1 === "function"
            ? styleFunction$1(name, i, tweenValue(this, "style." + name, value$$1))
            : styleConstant$1(name, i, value$$1 + ""), priority);
  }

  function styleTween(name, value, priority) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.style.setProperty(name, i(t), priority);
      };
    }
    tween._value = value;
    return tween;
  }

  function transition_styleTween(name, value, priority) {
    var key = "style." + (name += "");
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
  }

  function textConstant$1(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction$1(value) {
    return function() {
      var value1 = value(this);
      this.textContent = value1 == null ? "" : value1;
    };
  }

  function transition_text(value) {
    return this.tween("text", typeof value === "function"
        ? textFunction$1(tweenValue(this, "text", value))
        : textConstant$1(value == null ? "" : value + ""));
  }

  function transition_transition() {
    var name = this._name,
        id0 = this._id,
        id1 = newId();

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          var inherit = get$1(node, id0);
          schedule(node, name, id1, i, group, {
            time: inherit.time + inherit.delay + inherit.duration,
            delay: 0,
            duration: inherit.duration,
            ease: inherit.ease
          });
        }
      }
    }

    return new Transition(groups, this._parents, name, id1);
  }

  var id = 0;

  function Transition(groups, parents, name, id) {
    this._groups = groups;
    this._parents = parents;
    this._name = name;
    this._id = id;
  }

  function transition(name) {
    return selection().transition(name);
  }

  function newId() {
    return ++id;
  }

  var selection_prototype = selection.prototype;

  Transition.prototype = transition.prototype = {
    constructor: Transition,
    select: transition_select,
    selectAll: transition_selectAll,
    filter: transition_filter,
    merge: transition_merge,
    selection: transition_selection,
    transition: transition_transition,
    call: selection_prototype.call,
    nodes: selection_prototype.nodes,
    node: selection_prototype.node,
    size: selection_prototype.size,
    empty: selection_prototype.empty,
    each: selection_prototype.each,
    on: transition_on,
    attr: transition_attr,
    attrTween: transition_attrTween,
    style: transition_style,
    styleTween: transition_styleTween,
    text: transition_text,
    remove: transition_remove,
    tween: transition_tween,
    delay: transition_delay,
    duration: transition_duration,
    ease: transition_ease
  };

  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }

  var pi = Math.PI;

  var tau = 2 * Math.PI;

  var defaultTiming = {
    time: null, // Set on use.
    delay: 0,
    duration: 250,
    ease: cubicInOut
  };

  function inherit(node, id) {
    var timing;
    while (!(timing = node.__transition) || !(timing = timing[id])) {
      if (!(node = node.parentNode)) {
        return defaultTiming.time = now(), defaultTiming;
      }
    }
    return timing;
  }

  function selection_transition(name) {
    var id,
        timing;

    if (name instanceof Transition) {
      id = name._id, name = name._name;
    } else {
      id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
    }

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          schedule(node, name, id, i, group, timing || inherit(node, id));
        }
      }
    }

    return new Transition(groups, this._parents, name, id);
  }

  selection.prototype.interrupt = selection_interrupt;
  selection.prototype.transition = selection_transition;

  /**
   * Create a toolbar
   * This class uses a lot of jQuery for dom element manipulation
   */

  class Toolbar {
      constructor(domId, tooltip=undefined, vertical=false){
          $(`#${domId}`).show(); // if hidden

          // add a new bargroup div to domID with bootstrap button classes
          const btnClasses = vertical?'btn-group-vertical btn-group-sm': 'btn-group btn-group-sm';
          this.bar = $('<div/>').addClass(btnClasses).appendTo(`#${domId}`);
          this.buttons = {};
          this.tooltip = tooltip;
      }

      /**
       * Create a download button for SVG
       * @param id {String} the button dom ID
       * @param svgId {String} the SVG dom ID to grab and download
       * @param outfileName {String} the download file name
       * @param cloneId {String} the cloned SVG dom ID
       * @param icon {String} a fontawesome's icon class name
       */
      createDownloadSvgButton(id, svgId, outfileName, cloneId, icon='fa-download'){
          const $button = this.createButton(id, icon);
          select(`#${id}`)
              .on('click', ()=>{
                  this.downloadSvg(svgId, outfileName, cloneId);
              })
              .on('mouseover', ()=>{
                  this.tooltip.show("Download");
              })
              .on('mouseout', ()=>{
                  this.tooltip.hide();
              });
      }

      createResetButton(id, callback, icon='fa-expand-arrows-alt'){
          const $button = this.createButton(id, icon);
          select(`#${id}`)
              .on('click', callback)
              .on('mouseover', ()=>{
                  this.tooltip.show("Reset the scales");
              })
              .on('mouseout', ()=>{
                  this.tooltip.hide();
              });
      }

      /**
       * create a button to the toolbar
       * @param id {String} the button's id
       * @param icon {String} a fontawesome icon class
       * Dependencies: Bootstrap, jQuery, Fontawesome
       */
      createButton(id, icon='fa-download'){
          const $button = $('<a/>').attr('id', id)
              .addClass('btn btn-default').appendTo(this.bar);
          $('<i/>').addClass(`fa ${icon}`).appendTo($button);
          this.buttons[id] = $button;
          return $button;
      }

      /**
       * attach a tooltip dom with the toolbar
       * @param tooltip {Tooltip}
       */
      attachTooltip(tooltip){
          this.tooltip = tooltip;
      }

      /**
       * Download SVG obj
       * @param svgId {String} the SVG dom ID
       * @param fileName {String} the output file name
       * @param cloneId {String} the temporary dom ID to copy the SVG to
       * Dependencies: FileSaver
       */
      downloadSvg(svgId, fileName, cloneId){
          // let svgObj = $($($(`${"#" +svgId} svg`))[0]); // complicated jQuery to get to the SVG object
          let svgObj = $($($(`${"#" +svgId}`))[0]);
          let $svgCopy = svgObj.clone()
          .attr("version", "1.1")
          .attr("xmlns", "http://www.w3.org/2000/svg");

          // parse and add all the CSS styling used by the SVG
          let styles = parseCssStyles(svgObj.get());
          $svgCopy.prepend(styles);

          $("#" + cloneId).html('').hide(); // make sure the copyID is invisible
          let svgHtml = $(`#${cloneId}`).append($svgCopy).html();

          let svgBlob = new Blob([svgHtml], {type: "image/svg+xml"});
          saveAs(svgBlob, fileName); // this is a FileSaver function....

          // clear the temp download div
          $(`#${cloneId}`).html('').hide();
      }
  }

  class Tooltip {
      constructor(id, verbose=false, offsetX=30, offsetY=-40, duration=100){
          this.id = id;
          this.verbose = verbose;
          this.offsetX = offsetX;
          this.offsetY = offsetY;
          this.duration = duration;
      }

      show(info) {
          if(this.verbose) console.log(info);
          this.edit(info);
          this.move();
          select("#" + this.id)
              .style("display", "inline")
              .transition()
              .duration(this.duration)
              .style("opacity", 1.0);

      }

      hide() {
          select("#" + this.id)
              .transition()
              .duration(this.duration)
              .style("opacity", 0.0);
          this.edit("");
      }

      move(x = event.pageX, y = event.pageY) {
          if (this.verbose) {
              console.log(x);
              console.log(y);
          }
          x = x + this.offsetX; // TODO: get rid of the hard-coded adjustment
          y = (y + this.offsetY)<0?10:y+this.offsetY;
          const t = select('#'+this.id)
              .style("left", `${x}px`)
              .style("top", `${y}px`);
      }

      edit(info) {
          select("#" + this.id)
              .html(info);
      }
  }

  class Heatmap {
      /* data is a json with the following attributes:
          x: the x label
          y: the y label
          value: the rendered numerical value (transformed)
          originalValue: the original numerical value
       */

      /**
       * constructor
       * @param data {Object}, see above
       * @param useLog {Boolean} performs log transformation
       * @param colorScheme {String}: recognized terms in Colors:getColorInterpolator
       */
      constructor(data, colorScheme="YlGnBu", useLog=true, base=10, r=2){
          this.data = data;
          this.useLog = useLog;
          this.base = base;
          this.nullColor = "#e6e6e6";
          this.colorScale = undefined;
          this.xList = undefined;
          this.yList = undefined;
          this.xScale = undefined;
          this.yScale = undefined;
          this.r = r;
          this.colorScheme = colorScheme;

          this.toolbar = undefined;
          this.tooltip = undefined;
      }

      /**
       * Create the toolbar panel
       * @param domId {String} the toolbar's dom ID
       * @param tooltip {Tooltip}
       * @returns {Toolbar}
       */

      createToolbar(domId, tooltip){
          this.toolbar = new Toolbar(domId, tooltip);
          return this.toolbar;
      }

       /**
       * Create the tooltip object
       * @param domId {String} the tooltip's dom ID
       * @returns {Tooltip}
       */
      createTooltip(domId){
          this.tooltip = new Tooltip(domId);
          select(`#${domId}`).classed('heatmap-tooltip', true);
          return this.tooltip;
      }

      /**
       * draw color legend for the heat map
       * @param dom {Selection} a d3 selection object
       * @param legendConfig {Object} with attr: x, y
       */

      drawColorLegend(dom, legendConfig={x:0, y:0}, ticks=5){
          drawColorLegend(this.data[0].unit||"Value", dom, this.colorScale, legendConfig, this.useLog, ticks, this.base);
      }

       /**
       * redraws the heatmap: when the xlist and ylist are changed, redraw the heatmap
       * @param dom {Selection} a d3 selection object
       * @param xList {List} a list of x labels
       * @param yList {List} a list of y labels
       * @param dimensions {Dictionary} {w:Integer, h:integer} with two attributes: w and h
       * @param angle {Integer} for the y text labels
       */
      redraw(dom, xList, yList, dimensions={w:1000, h:1000}, angle=30){
          this._setXList(dimensions.w, xList);
          this._setYList(dimensions.h, yList);
          this.draw(dom, dimensions, angle);
      }

      /**
       * draws the heatmap
       * @param dom {Selection}
       * @param dimensions {Dictionary} {w:Integer, h:integer} of the heatmap
       * @param angle {Integer} for the y text labels
       * @param useNullColor {Boolean} whether to render null values with the pre-defined null color
       */

      draw(dom, dimensions={w:1000, h:600}, angle=30, useNullColor=true){
          if (this.xList === undefined) this._setXList(dimensions.w);
          if (this.yList === undefined) this._setYList(dimensions.h);
          if (this.colorScale === undefined) this.colorScale = setColorScale(this.data.map((d)=>d.value), this.colorScheme);

          // text labels
          // data join
          const xLabels = dom.selectAll(".exp-map-xlabel")
              .data(this.xList);

          // update old elements
          const Y = this.yScale.range()[1] + (this.yScale.bandwidth() * 2);
          const adjust = 5;
          xLabels.attr("transform", (d) => {
                  let x = this.xScale(d) + adjust;
                  let y = Y;
                  return `translate(${x}, ${y}) rotate(${angle})`;
              });
              // .attr("class", (d, i) => `exp-map-xlabel x${i}`);


          // enters new elements
          xLabels.enter().append("text")
              .attr("class", (d, i) => `exp-map-xlabel x${i}`)
              .attr("x", 0)
              .attr("y", 0)
              .style("text-anchor", "start")
              .style("cursor", "default")
              .attr("transform", (d) => {
                  let x = this.xScale(d) + adjust;
                  let y = Y;
                  return `translate(${x}, ${y}) rotate(${angle})`;
              })
              .merge(xLabels)
              .text((d) => d);

          // exit -- removes old elements as needed
          xLabels.exit().remove();

          const yLabels = dom.selectAll(".exp-map-ylabel")
              .data(this.yList)
              .enter().append("text")
              .text((d) => d)
              .attr("x", this.xScale.range()[1] + 5)
              .attr("y", (d) => this.yScale(d) + 10)
              .attr("class", (d, i) => `exp-map-ylabel y${i}`)
              .style("text-anchor", "start")
              .style("cursor", "default")
              .on('click', (d) => {
                  alert(`${d} is clicked. To be implemented`);
              })
              .on('mouseover', function(d){
                  select(this)
                      .classed('normal', false)
                      .classed('highlighted', true);
              })
              .on('mouseout', function(d){
                  select(this)
                      .classed('normal', true)
                      .classed('highlighted', false);
              });

          // renders the heatmap cells

          // data join
          const cells = dom.selectAll(".exp-map-cell")
              .data(this.data, (d) => d.value);

          // update old elements
          cells.attr("x", (d) => this.xScale(d.x))
              .attr("y", (d) => this.yScale(d.y))
              .attr("row", (d) => `x${this.xList.indexOf(d.x)}`)
              .attr("col", (d) => `y${this.yList.indexOf(d.y)}`);

          // enter new elements
          const nullColor = "#DDDDDD";
          const self = this;
          cells.enter().append("rect")
              .attr("row", (d) => `x${this.xList.indexOf(d.x)}`)
              .attr("col", (d) => `y${this.yList.indexOf(d.y)}`)

              .attr("x", (d) => this.xScale(d.x))
              .attr("y", (d) => this.yScale(d.y))
              .attr("rx", this.r)
              .attr('ry', this.r)
              .attr("class", (d) => `exp-map-cell`)
              .attr("width", this.xScale.bandwidth())
              .attr("height", this.yScale.bandwidth())
              .style("fill", (d) => "#eeeeee")
              .on("mouseover", function(d){
                  const selected = select(this); // Note: "this" here refers to the dom element not the object
                  self.cellMouseover(selected);
              })
              .on("mouseout", function(d){
                  const selected = select(this); // Note: "this" here refers to the dom element not the object
                  self.cellMouseout();
              })
              .merge(cells)
              // .transition()
              // .duration(2000)
              .style("fill", (d) => useNullColor&&d.originalValue==0?nullColor:this.colorScale(d.value)); // TODO: what if null value isn't 0?

          // exit and remove
          cells.exit().remove();
      }

      cellMouseout(d){
          selectAll("*").classed('highlighted', false);
      }

      cellMouseover (selected) {
          const rowClass = selected.attr("row");
          const colClass = selected.attr("col");
          selectAll(".exp-map-xlabel").filter(`.${rowClass}`)
              .classed('highlighted', true);
          selectAll(".exp-map-ylabel").filter(`.${colClass}`)
              .classed('highlighted', true);
          selected.classed('highlighted', true);
      }

      _setXList(width, newList) {
          if(newList !== undefined){
              this.xList = newList;
          }
          else {
              this.xList = nest()
                  .key((d) => d.x)
                  .entries(this.data)
                  .map((d) => d.key);
          }
          this.xScale = band()
              .domain(this.xList)
              .range([0, width])
              .padding(.05); // TODO: eliminate hard-coded value
      }

      _setYList(height, newList) {
          if(newList !== undefined){
              this.yList = newList;
          }
          else {
             this.yList = nest()
              .key((d) => d.y)
              .entries(this.data)
              .map((d) => d.key);
          }
          this.yScale = band()
                  .domain(this.yList)
                  .range([0, height])
                  .padding(.05); // TODO: eliminate hard-coded value
      }


  }

  class DendroHeatmap {

      /**
       * Constructor
       * @param columnTree {String} a newick tree
       * @param rowTree {String} a newick tree
       * @param heatmapData {List} of objects with attributes: x: String, y:String, value:Float, originalValue:Float
       * @param color {String} a color name that's available in Colors.getColorInterpolator
       * @param r {Integer} the degrees of rounded-corners of the heatmap cells
       * @param config {DendroHeatmapConfig}
       * @param useLog {Boolean}
       */
      constructor(columnTree, rowTree, heatmapData, color="YlGnBu", r=2, config=new DendroHeatmapConfig(), useLog=true, base=10, title = ''){
          this.config = config.get();
          //input evaluations
          columnTree = columnTree===undefined||columnTree.startsWith("Not enough data")?undefined:columnTree;
          rowTree = rowTree===undefined||rowTree.startsWith("Not enough data")?undefined:rowTree;
          // assign attribute values based on input arguments
          this.data = {
              columnTree: columnTree,
              rowTree: rowTree,
              heatmap: heatmapData,
              external: undefined
          };
          this.objects = {
              columnTree: this.data.columnTree===undefined? undefined:new Dendrogram(this.data.columnTree, "v"),
              rowTree: this.data.rowTree===undefined?undefined:new Dendrogram(this.data.rowTree, "h"),
              heatmap: new Heatmap(this.data.heatmap, color, useLog, base, r)
          };
          this.visualComponents = {
              svg: undefined,
              columnTree: undefined,
              rowTree: undefined
          };

          this.title = title;

          this.tooltip = undefined;
          this.toolbar = undefined;
      }

      /**
       * Create the toolbar panel
       * @param domId {String} the toolbar's dom ID
       * @param tooltip {Tooltip}
       * @returns {Toolbar}
       */

      createToolbar(domId, tooltip){
          this.toolbar = new Toolbar(domId, tooltip);
          return this.toolbar;
      }

       /**
       * Create the tooltip object
       * @param domId {String} the tooltip's dom ID
       * @returns {Tooltip}
       */
      createTooltip(domId){
          this.tooltip = new Tooltip(domId);
          select(`#${domId}`).classed('heatmap-tooltip', true);
          return this.tooltip;
      }

      /**
       * Render the dendrograms and corresponding heatmap
       * @param domId {String} the parent DOM id of the SVG
       * @param svgId {String} of the SVG
       * @param showColumnTree {Boolean} render the column dendrogram
       * @param showRowTree {Boolean} render the row dendrogram
       * @param legendPos {Enum} where to place the color legend: bottom, top
       * @param ticks {Integer} number of bins of the color legend
       */
      render(domId, svgId, showColumnTree=true, showRowTree=true, legendPos="top", ticks=5){
          this._updateConfig(legendPos);
          this.visualComponents.svg = createSvg(domId, this.config.w, this.config.h, this.config.margin, svgId);

          let xlist = undefined,
              ylist = undefined;

          if (showColumnTree && this.objects.columnTree!==undefined){
              this.visualComponents.columnTree = this._renderTree("column", this.objects.columnTree, this.config.panels.top);
              xlist = this.objects.columnTree.xScale.domain();
          }
          if (showRowTree && this.objects.rowTree !== undefined){
              this.visualComponents.rowTree = this._renderTree("row", this.objects.rowTree, this.config.panels.left);
              ylist = this.objects.rowTree.yScale.domain();
          }

          if (this.title != '') {
              console.log(this.title);
              select(`#${domId}-svg`).append('text')
                  .attr('x', 0)
                  .attr('y', 20)
                  .text(this.title);
          }

          this._renderHeatmap(this.objects.heatmap, xlist, ylist, ticks);
      }

      /**
       * Render a newick tree
       * @param direction {enum} column or row
       * @param tree {Dendrogram} a Dendrogram object
       * @param config {Object} a panel config with attributes: x, y, width and height
       * @private
       */
      _renderTree(direction, tree, config){
          let svg = this.visualComponents.svg;
          const labelClass = direction=="row"?".exp-map-ylabel":".exp-map-xlabel";

          const tooltip = this.visualComponents.tooltip;
          const g = svg.append("g")
              .attr("id", config.id)
              .attr("transform", `translate(${config.x}, ${config.y})`);
          tree.draw(g, config.w, config.h);

          const mouseout = function(){
              select(this)
                  .attr("r", 2)
                  .attr("fill", "#333");
              svg.selectAll(labelClass).classed("highlighted", false);
              svg.selectAll(".leaf-color").classed("highlighted", false);
          };

          const mouseover = function(d){
              select(this)
                  .attr("r", 6)
                  .attr("fill", "red");
              let ids = d.leaves().map((node)=>node.data.name);
              svg.selectAll(labelClass)
                  .filter((label)=>ids.includes(label))
                  .classed("highlighted", true);
              svg.selectAll(".leaf-color")
                  .filter((label)=>ids.includes(label))
                  .classed("highlighted", true);
          };

          g.selectAll(".dendrogram-node")
              .on("mouseover", mouseover)
              .on("mouseout", mouseout);
          return g;
      }

      /**
       * Render the heatmap and color legend
       * @param heatmap {Heatmap} a Heatmap object
       * @param xList {List} a list of x labels
       * @param yList {List} a list of y labels
       * @param ticks {Integer} the number of bins in the color legend
       * @private
       */
      _renderHeatmap(heatmap, xList, yList, ticks=5){
          let dom = this.visualComponents.svg;
          const config = this.config.panels.main;
          const g = dom.append("g")
              .attr("id", config.id)
              .attr("transform", `translate(${config.x}, ${config.y})`);
          heatmap.redraw(g, xList, yList, {w: config.w, h: config.h});
          heatmap.drawColorLegend(dom, this.config.panels.legend, ticks);
      }

      /**
       * Adjust the layout dimensions based on the actual data
       * @param legendPos {String} bottom or top
       * @private
       */
      _updateConfig(legendPos){
          const rows = this.objects.rowTree===undefined?1:this.objects.rowTree.leaves.length;

          // updates the left panel's height based on the data
          this.config.panels.left.h = this.config.cell.h * rows<20?20:this.config.cell.h * rows;
          this.config.h += this.config.panels.left.h;
          this.config.panels.main.h = this.config.panels.left.h;
          if(legendPos=="bottom") this.config.panels.legend.y += this.config.panels.main.h + this.config.panels.main.x + 50;


      }
  }

  var pi$1 = Math.PI,
      tau$1 = 2 * pi$1,
      epsilon$1 = 1e-6,
      tauEpsilon = tau$1 - epsilon$1;

  function Path() {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null; // end of current subpath
    this._ = "";
  }

  function path() {
    return new Path;
  }

  Path.prototype = path.prototype = {
    constructor: Path,
    moveTo: function(x, y) {
      this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y);
    },
    closePath: function() {
      if (this._x1 !== null) {
        this._x1 = this._x0, this._y1 = this._y0;
        this._ += "Z";
      }
    },
    lineTo: function(x, y) {
      this._ += "L" + (this._x1 = +x) + "," + (this._y1 = +y);
    },
    quadraticCurveTo: function(x1, y1, x, y) {
      this._ += "Q" + (+x1) + "," + (+y1) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
    },
    bezierCurveTo: function(x1, y1, x2, y2, x, y) {
      this._ += "C" + (+x1) + "," + (+y1) + "," + (+x2) + "," + (+y2) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
    },
    arcTo: function(x1, y1, x2, y2, r) {
      x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
      var x0 = this._x1,
          y0 = this._y1,
          x21 = x2 - x1,
          y21 = y2 - y1,
          x01 = x0 - x1,
          y01 = y0 - y1,
          l01_2 = x01 * x01 + y01 * y01;

      // Is the radius negative? Error.
      if (r < 0) throw new Error("negative radius: " + r);

      // Is this path empty? Move to (x1,y1).
      if (this._x1 === null) {
        this._ += "M" + (this._x1 = x1) + "," + (this._y1 = y1);
      }

      // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
      else if (!(l01_2 > epsilon$1)) ;

      // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
      // Equivalently, is (x1,y1) coincident with (x2,y2)?
      // Or, is the radius zero? Line to (x1,y1).
      else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon$1) || !r) {
        this._ += "L" + (this._x1 = x1) + "," + (this._y1 = y1);
      }

      // Otherwise, draw an arc!
      else {
        var x20 = x2 - x0,
            y20 = y2 - y0,
            l21_2 = x21 * x21 + y21 * y21,
            l20_2 = x20 * x20 + y20 * y20,
            l21 = Math.sqrt(l21_2),
            l01 = Math.sqrt(l01_2),
            l = r * Math.tan((pi$1 - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
            t01 = l / l01,
            t21 = l / l21;

        // If the start tangent is not coincident with (x0,y0), line to.
        if (Math.abs(t01 - 1) > epsilon$1) {
          this._ += "L" + (x1 + t01 * x01) + "," + (y1 + t01 * y01);
        }

        this._ += "A" + r + "," + r + ",0,0," + (+(y01 * x20 > x01 * y20)) + "," + (this._x1 = x1 + t21 * x21) + "," + (this._y1 = y1 + t21 * y21);
      }
    },
    arc: function(x, y, r, a0, a1, ccw) {
      x = +x, y = +y, r = +r;
      var dx = r * Math.cos(a0),
          dy = r * Math.sin(a0),
          x0 = x + dx,
          y0 = y + dy,
          cw = 1 ^ ccw,
          da = ccw ? a0 - a1 : a1 - a0;

      // Is the radius negative? Error.
      if (r < 0) throw new Error("negative radius: " + r);

      // Is this path empty? Move to (x0,y0).
      if (this._x1 === null) {
        this._ += "M" + x0 + "," + y0;
      }

      // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
      else if (Math.abs(this._x1 - x0) > epsilon$1 || Math.abs(this._y1 - y0) > epsilon$1) {
        this._ += "L" + x0 + "," + y0;
      }

      // Is this arc empty? We’re done.
      if (!r) return;

      // Does the angle go the wrong way? Flip the direction.
      if (da < 0) da = da % tau$1 + tau$1;

      // Is this a complete circle? Draw two arcs to complete the circle.
      if (da > tauEpsilon) {
        this._ += "A" + r + "," + r + ",0,1," + cw + "," + (x - dx) + "," + (y - dy) + "A" + r + "," + r + ",0,1," + cw + "," + (this._x1 = x0) + "," + (this._y1 = y0);
      }

      // Is this arc non-empty? Draw an arc!
      else if (da > epsilon$1) {
        this._ += "A" + r + "," + r + ",0," + (+(da >= pi$1)) + "," + cw + "," + (this._x1 = x + r * Math.cos(a1)) + "," + (this._y1 = y + r * Math.sin(a1));
      }
    },
    rect: function(x, y, w, h) {
      this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y) + "h" + (+w) + "v" + (+h) + "h" + (-w) + "Z";
    },
    toString: function() {
      return this._;
    }
  };

  function constant$5(x) {
    return function constant() {
      return x;
    };
  }

  var pi$2 = Math.PI;

  function Linear(context) {
    this._context = context;
  }

  Linear.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._point = 0;
    },
    lineEnd: function() {
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; // proceed
        default: this._context.lineTo(x, y); break;
      }
    }
  };

  function curveLinear(context) {
    return new Linear(context);
  }

  function x(p) {
    return p[0];
  }

  function y(p) {
    return p[1];
  }

  function line() {
    var x$$1 = x,
        y$$1 = y,
        defined = constant$5(true),
        context = null,
        curve = curveLinear,
        output = null;

    function line(data) {
      var i,
          n = data.length,
          d,
          defined0 = false,
          buffer;

      if (context == null) output = curve(buffer = path());

      for (i = 0; i <= n; ++i) {
        if (!(i < n && defined(d = data[i], i, data)) === defined0) {
          if (defined0 = !defined0) output.lineStart();
          else output.lineEnd();
        }
        if (defined0) output.point(+x$$1(d, i, data), +y$$1(d, i, data));
      }

      if (buffer) return output = null, buffer + "" || null;
    }

    line.x = function(_) {
      return arguments.length ? (x$$1 = typeof _ === "function" ? _ : constant$5(+_), line) : x$$1;
    };

    line.y = function(_) {
      return arguments.length ? (y$$1 = typeof _ === "function" ? _ : constant$5(+_), line) : y$$1;
    };

    line.defined = function(_) {
      return arguments.length ? (defined = typeof _ === "function" ? _ : constant$5(!!_), line) : defined;
    };

    line.curve = function(_) {
      return arguments.length ? (curve = _, context != null && (output = curve(context)), line) : curve;
    };

    line.context = function(_) {
      return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line) : context;
    };

    return line;
  }

  function point$3(that, x, y) {
    that._context.bezierCurveTo(
      that._x1 + that._k * (that._x2 - that._x0),
      that._y1 + that._k * (that._y2 - that._y0),
      that._x2 + that._k * (that._x1 - x),
      that._y2 + that._k * (that._y1 - y),
      that._x2,
      that._y2
    );
  }

  function Cardinal(context, tension) {
    this._context = context;
    this._k = (1 - tension) / 6;
  }

  Cardinal.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x2, this._y2); break;
        case 3: point$3(this, this._x1, this._y1); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; this._x1 = x, this._y1 = y; break;
        case 2: this._point = 3; // proceed
        default: point$3(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  var curveCardinal = (function custom(tension) {

    function cardinal(context) {
      return new Cardinal(context, tension);
    }

    cardinal.tension = function(tension) {
      return custom(+tension);
    };

    return cardinal;
  })(0);

  function sign(x) {
    return x < 0 ? -1 : 1;
  }

  // Calculate the slopes of the tangents (Hermite-type interpolation) based on
  // the following paper: Steffen, M. 1990. A Simple Method for Monotonic
  // Interpolation in One Dimension. Astronomy and Astrophysics, Vol. 239, NO.
  // NOV(II), P. 443, 1990.
  function slope3(that, x2, y2) {
    var h0 = that._x1 - that._x0,
        h1 = x2 - that._x1,
        s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0),
        s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0),
        p = (s0 * h1 + s1 * h0) / (h0 + h1);
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }

  // Calculate a one-sided slope.
  function slope2(that, t) {
    var h = that._x1 - that._x0;
    return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
  }

  // According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
  // "you can express cubic Hermite interpolation in terms of cubic Bézier curves
  // with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
  function point$5(that, t0, t1) {
    var x0 = that._x0,
        y0 = that._y0,
        x1 = that._x1,
        y1 = that._y1,
        dx = (x1 - x0) / 3;
    that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
  }

  function MonotoneX(context) {
    this._context = context;
  }

  MonotoneX.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 =
      this._y0 = this._y1 =
      this._t0 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x1, this._y1); break;
        case 3: point$5(this, this._t0, slope2(this, this._t0)); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      var t1 = NaN;

      x = +x, y = +y;
      if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; point$5(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
        default: point$5(this, this._t0, t1 = slope3(this, x, y)); break;
      }

      this._x0 = this._x1, this._x1 = x;
      this._y0 = this._y1, this._y1 = y;
      this._t0 = t1;
    }
  };

  function MonotoneY(context) {
    this._context = new ReflectContext(context);
  }

  (MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x, y) {
    MonotoneX.prototype.point.call(this, y, x);
  };

  function ReflectContext(context) {
    this._context = context;
  }

  ReflectContext.prototype = {
    moveTo: function(x, y) { this._context.moveTo(y, x); },
    closePath: function() { this._context.closePath(); },
    lineTo: function(x, y) { this._context.lineTo(y, x); },
    bezierCurveTo: function(x1, y1, x2, y2, x, y) { this._context.bezierCurveTo(y1, x1, y2, x2, y, x); }
  };

  class GeneModel {
      /**
       * constructor
       * @param gene {Object} with attributes: strand, transcriptId, geneSymbol
       * @param exons {List} of exon objects with attributes: chrom, chromStart, chromEnd, length, exonNumber, exonId
       * @param exonsCurated {List} of exon objects in the final gene model. This is pretty specific to GTEx. If this list isn't available for your data, then just pass in the same exon list again.
       * @param junctions {List} of junction objects with attributes: chrom, chromStart, chromEnd, junctionId
       * @param isIsoform {Boolean}
       * @param maxIntronLength {Integer} the maximum length of intron. Intron rendering is capped at this value
       * @param minExonWidth {Integer} the minimum width (pixels) of the exon rectangle.
       */

      /** NOTE: the exonNumber in exons & exonsCurated don't refer to the same exons (at least this is the case in GTEx)
       *  To ensure correct exon mapping of the curated gene model to the original model, here we use genomic position.
       */
      constructor (gene, exons, exonsCurated, junctions, isIsoform=false, maxIntronLength=1000, minExonWidth=0){
          this.gene = gene;
          this.exons = exons;
          if (this.gene.strand == "+") this.exons.sort((a, b)=>{return Number(a.exonNumber)-Number(b.exonNumber)});
          else this.exons.sort((a, b)=>{return Number(b.exonNumber)-Number(a.exonNumber)});
          this.exonsCurated = exonsCurated.sort((a, b)=>{return Number(a.exonNumber)-Number(b.exonNumber)});
          this.junctions = junctions.sort((a,b) => {
              if (a.junctionId < b.junctionId) return -1;
              if (a.junctionId > b.junctionId) return 1;
              return 0;
          }); // sorted by junction ID
          this.isIsoform = isIsoform;
          this.maxIntronLength = maxIntronLength;

          // hard-coded for now
          this.intronLength = 0; // fixed fake intron length in base pairs, obsolete?
          this.minExonWidth = minExonWidth; // minimum exon width in pixels
          this.nullColor = '#DDDDDD';
      }

      changeTextlabel(dom, label){
          dom.selectAll("#modelInfo").text(label);
      }

      /**
       *
       * @param dom {Object} of D3
       * @param jdata {List} of junction expression objects
       * @param edata {List} of exon expression objects
       * @param jscale {D3 scale} of colors of junction data
       * @param escale {D3 scale} of colors of exon data
       */
      addData(dom, jdata, edata, jscale, escale){
          if (jdata !== undefined){
              dom.selectAll(".junc").style("fill", (d) => {
                  const v = jdata.filter((z)=>z.junctionId==d.junctionId)[0];
                  const jcolor = v.value==0?this.nullColor:jscale(v.value);
                  dom.selectAll(".junc-curve").filter((`.junc${d.junctionId}`)).style("stroke", jcolor);
                  return jcolor;
              });
          }

          dom.selectAll(".exon-curated").style("fill", (d) => {
              const v = edata.filter((z)=>z.exonId==d.exonId)[0];
              if (v === undefined) throw `${d.exonId} has no data`;
              const ecolor = v.value == 0?this.nullColor:escale(v.value);
              return ecolor;
          });
      }

      /**
       * render the SVG of the gene model
       * @param dom: an SVG dom object
       * @param config

       */
      render(dom, config) {
          this.setXscale(config.w);

          /* Note: exon.x, exon.w are in pixels for visual rendering */
          /* Note: exon.length is in base pairs */
          // calculating x and w for each exon
          const exonY = config.h/2; // TODO: remove hard-coded values
          this.exons.forEach((d, i) => {
              if (i == 0) {
                  d.x = 0;
              } else {
                  d.x = this.exons[i-1].x + this.exons[i-1].w + this.xScale(d.intronLength>this.maxIntronLength?this.maxIntronLength:d.intronLength);
              }
              d.w = this.xScale(d.length)<this.minExonWidth?this.minExonWidth:this.xScale(d.length);
          });

          // calculaing x and w of the rectangle for each curated exon on the final gene model
          this.exonsCurated.forEach((d, i) => {
              // first, map each final curated exon to the original full gene model--find the original exon
              // find the original exon
              d.oriExon = this._findExon(d.chromStart)||this._findExon(d.chromEnd);
              if (d.oriExon === undefined) {
                  // if not found
                  console.warn(`${this.gene.transcriptId}-${d.exonId} can't map to full gene model`);
                  return; // ignore unmappable exons, this happens at times (why?)
              }

              // calculate for x
              if (Number(d.oriExon.chromStart) == Number(d.chromStart)) d.x = d.oriExon.x;
              else{
                  // if this exon doesn't start from the oriExon start pos
                  const dist = Number(d.chromStart) - Number(d.oriExon.chromStart) + 1;
                  d.x = d.oriExon.x + this.xScale(dist);
              }

              // calculate for w
              if (d.length === undefined) d.length = Number(d.chromEnd) - Number(d.chromStart) + 1;
              d.w = this.xScale(d.length)<this.minExonWidth?this.minExonWidth:this.xScale(d.length);

          });

          // evaluates whether it's an individual isoform or a collapsed gene model
          if(!this.isIsoform){
              // NOTE: do not alter the rendering order of visual components.
              // if this is a gene model, not an isoform
              // calculating positions for each junction
              this.junctions = this.junctions.filter((d)=>{
                  // first filter unmapped junctions
                  d.startExon = this._findExon(d.chromStart);
                  d.endExon = this._findExon(d.chromEnd);
                  return d.startExon !== undefined && d.endExon !== undefined
              });
              console.log(this.junctions);
              this.junctions.sort((a,b)=>{
                  // first sort by chromStart
                  if (+a.chromStart < +b.chromStart) return -1;
                  if (+a.chromStart > +b.chromStart) return 1;

                  // then sort by chromEnd:
                  if (+a.chromEnd < +b.chromEnd) return -1;
                  if (+a.chromEnd > +b.chromEnd) return 1;
                  return 0;
              });
              this.junctions.forEach((d, i) => {
                  // d.startExon = this._findExon(d.chromStart);
                  // d.endExon = this._findExon(d.chromEnd);
                  d.displayName = `Junction ${i+1}`;


                  // d.displayName = `Exon ${d.startExon.exonNumber} - ${d.endExon.exonNumber}`;
                  // if (d.startExon.exonNumber == d.endExon.exonNumber) {
                  //     console.warn(d.junctionId + " is in Exon: " +d.startExon.chromStart + " - " + d.startExon.chromEnd );
                  // } // what is happening

                  // d.filtered = false;

                  // calculate for positions
                  const dist = Number(d.chromStart) - Number(d.startExon.chromStart) + 1;
                  const dist2 = Number(d.chromEnd) - Number(d.endExon.chromStart) + 1;

                  d.startX = d.startExon.x + this.xScale(dist);
                  d.endX = d.endExon.x + this.xScale(dist2);
                  d.cx = d.startX + (d.endX - d.startX + 1)/2; // junction is rendered at the midpoint between startX and endX
                  d.cy = exonY - 15 * ( Math.abs(Number(d.endExon.exonNumber) - Number(d.startExon.exonNumber)) + 0.5 );
                  if (d.cy < 0) d.cy = 0;

              });

              // handling edge case: overlapping junctions, add jitter
              // a.reduce((r,k)=>{r[k]=1+r[k]||1;return r},{})
              const counts = this.junctions.reduce((r,d)=>{r[d.displayName]=1+r[d.displayName]||1;return r},{});
              this.junctions.forEach((d) => {
                  // jitter
                  if(counts[d.displayName] > 1){ // overlapping junctions
                      // d.cx += Math.random()*20;
                      d.cy -= Math.random()*15;
                  }
              });

              /***** render junctions */
              const curve = line()
                  .x((d) => d.x)
                  .y((d) => d.y)
                  .curve(curveCardinal);

              this.junctions.forEach((d, i) => {
                          dom.append("path")
                          .datum([{x:d.startX, y:exonY}, {x:d.cx, y:d.cy}, {x:d.endX, y:exonY}]) // the input points to draw the curve
                          .attr("class", `junc-curve junc${d.junctionId}`)
                          .attr("d", curve)
                          .style("stroke", "#92bcc9");
                      });


              const juncDots = dom.selectAll(".junc")
                  .data(this.junctions);

              // updating elements
              juncDots.attr("cx", (d) => d.cx);
              juncDots.attr("cy", (d) => d.cy); // TODO: remove hard-coded values

              // entering new elements
              juncDots.enter().append("circle")
                  .attr("class", (d) => `junc junc${d.junctionId}`)
                  .attr("cx", (d) => d.cx)
                  .attr("cy", (d) => d.cy)
                  .merge(juncDots)
                  .attr("r", 4)
                  .style("fill", "rgb(86, 98, 107)");

              /***** rendering full gene model exons */
              const exonRects = dom.selectAll(".exon")
              .data(this.exons);

              // updating elements
              exonRects.attr("x", (d) => d.x);
              exonRects.attr("y", exonY);

              // entering new elements
              exonRects.enter().append("rect")
                  .attr("class", (d)=>`exon exon${d.exonNumber}`)
                  .attr("y", exonY)
                  .attr("rx", 2)
                  .attr('ry', 2)
                  .attr("width", (d) => d.w)
                  .attr("height", 15) // TODO: remove hard-coded values
                  .attr("x", (d) => d.x)
                  .merge(exonRects)
                  .style("cursor", "default");

              // model info text label
              dom.append("text")
                  .attr("id", "modelInfo") // TODO: no hard-coded value
                  .style("text-anchor", "end")
                  .attr("x", this.xScale(0))
                  .attr("y", exonY-10)
                  .style("font-size", 12)
                  .text("Gene Model");
          }
          else{
              // if this is an isoform, render the intron line
              const intronLine = dom.append("line")
                  .attr("x1", this.exonsCurated[0].x)
                  .attr("x2", this.exonsCurated[this.exonsCurated.length-1].x)
                  .attr("y1", exonY + (15/2))
                  .attr("y2", exonY + (15/2))
                  .classed("intron", true);
          }

          /***** rendering curated exons on the final gene model or isoform exons */
          const exonRects2 = dom.selectAll(".exon-curated")
              .data(this.exonsCurated);

          // updating elements
          exonRects2.attr("x", (d) => d.x);
          exonRects2.attr("y", exonY);

          // entering new elements
          exonRects2.enter().append("rect")
              .attr("class", (d)=>this.isIsoform?'exon-curated':`exon-curated exon-curated${d.exonNumber}`)
              .attr("y", exonY)
              .attr("width", (d) => d.w)
              .attr("height", 15) // TODO: remove hard-coded values
              .attr("x", (d) => d.x)
              .merge(exonRects2)
              .style("fill", "#eee")
              .style("cursor", "default");


          /***** rendering text labels */
          if (config.labelOn == 'left' || config.labelOn == 'both'){
              dom.append("text")
              .attr("id", "modelLabel") // TODO: no hard-coded value
              .style("text-anchor", "end")
              .attr("x", this.xScale.range()[0] - 5)
              .attr("y", exonY + 7.5)
              .style("font-size", "9px")
              .text(this.gene.transcriptId===undefined?`${this.gene.geneSymbol}`:this.gene.transcriptId);


          }
          if (config.labelOn == 'right' || config.labelOn == 'both'){
              dom.append("text")
              .attr("id", "modelLabelRight") // TODO: no hard-coded value
              .style("text-anchor", "start")
              .attr("x", this.xScale.range()[1] + 50)
              .attr("y", exonY + 7.5)
              .style("font-size", "9px")
              .text(this.gene.transcriptId===undefined?`${this.gene.geneSymbol}`:this.gene.transcriptId);

          }
      }

      setXscale(w){
          // concept explained:
          // assuming the canvas width is fixed
          // the task is how to render all exons + fixed-width introns within the canvas
          // first find the largest exon,
          // then set the x scale of the canvas to accommodate max(exon length)*exon counts,
          // this ensures that there's always space for rendering introns
          // the fixed intron width is calculated as such:
          // ((max(exon length) * exon counts) - total exon length)/(exon counts - 1)

          this.exons.sort((a,b)=>{
              if (Number(a.chromStart) < Number(b.chromStart)) return -1;
              if (Number(a.chromStart) > Number(b.chromStart)) return 1;
              return 0;
          });

          let sum$$1 = 0;
          this.exons.forEach((d, i)=>{
              d.length = Number(d.chromEnd) - Number(d.chromStart) + 1;
              if (i == 0){
                  // the first exon
                  sum$$1 += d.length;
              } else {
                  let nb = this.exons[i-1]; // the upstream neighbor exon
                  d.intronLength = Number(d.chromStart) - Number(nb.chromEnd) + 1;
                  sum$$1 += d.length + (d.intronLength>this.maxIntronLength?this.maxIntronLength:d.intronLength);
              }
          });

          const domain = [0, sum$$1];
          const range = [0, w];
          this.xScale = linear$1()
              .domain(domain)
              .range(range);
      }

      setXscaleFixIntron(w){
          // concept explained:
          // assuming the canvas width is fixed
          // the task is how to render all exons + fixed-width introns within the canvas
          // first find the largest exon,
          // then set the x scale of the canvas to accommodate max(exon length)*exon counts,
          // this ensures that there's always space for rendering introns
          // the fixed intron width is calculated as such:
          // ((max(exon length) * exon counts) - total exon length)/(exon counts - 1)

          this.exons.forEach((d) => {d.length = Number(d.chromEnd) - Number(d.chromStart) + 1;});
          const maxExonLength = max(this.exons, (d)=>d.length);

          const domain = [0, maxExonLength*this.exons.length];
          const range = [0, w];
          this.xScale = linear$1()
              .domain(domain)
              .range(range);

          // fixed intron width
          const minLength = this.xScale.invert(this.minExonWidth); // the minimum exon length that maps to minimum exon width (pixels) using xScale
          const totalExonLength = sum(this.exons, (d)=>d.length>minLength?d.length:minLength); // if an exon is shorter than min length, use min length
          this.intronLength = (maxExonLength * this.exons.length - totalExonLength)/(this.exons.length-1); // caluclate the fixed intron length
      }

      /**
       * For a given position, find the exon
       * @param pos {Integer}: a genomic position
       * @private
       */
      _findExon(pos){
          pos = Number(pos);
          const results = this.exons.filter((d) => {return Number(d.chromStart) - 1 <= pos && Number(d.chromEnd) + 1 >= pos});
          if (results.length == 1) return results[0];
          else if(results.length == 0) {
              console.warn("No exon found for: " + pos);
              return undefined;
          }
          else {
              console.warn("More than one exons found for: " + pos);
              return undefined;
          }

      }

  }

  class IsoformTrackViewer {
      constructor(isoforms, isoformExons, modelExons, config){
          this.isoforms = isoforms;
          this.isoformExons = isoformExons;
          this.modelExons = modelExons;
          this.visualDom = undefined;
          this.config = config;
          this.nullColor = "#DDDDDD";
      }

      showData(data, colorScale, barScale, dataLabel, sort=true){

          if (sort){
              data.sort((a,b)=>{return -(a.originalValue - b.originalValue)}); // first sort the expression data
              const ids = data.map((d)=>d.transcriptId);
              this.sortTracks(ids);
          }

          data.forEach((d)=>{
              const isoform = this.visualDom.select(`#${d.transcriptId.replace(".", "_")}`);
              isoform.selectAll(".exon-curated")
                  .style("fill", d.value==0?this.nullColor:colorScale(d.value));
          });

          // render the lollipop graph
          this.visualDom.select(".lollipopGraph").remove();
          const lollipopGraph = this.visualDom.append("g")
              .classed("lollipopGraph", true)
              .attr("transform", `translate(-100, 13)`); // TODO: remove hard-coded values

          const lollipops = lollipopGraph.selectAll(".lollipop")
              .data(data);

          const g = lollipops.enter()
              .append("g")
              .classed("lollipop", true);

          g.append("line")
              .attr("x1", 0)
              .attr("y1", (d)=>this.yScale(d.transcriptId))
              .attr("y2", (d)=>this.yScale(d.transcriptId))
              .style("stroke", (d)=>d.value==0?this.nullColor:colorScale(d.value))
              .style("stroke-width", 2)
              .transition()
              .duration(1000)
              .attr("x2", (d)=>d.value==0?0:barScale(d.value));

          g.append("circle")
              .attr("cx", 0)
              .attr("cy", (d)=>this.yScale(d.transcriptId) )
              .attr("r", 5)
              .style("fill", (d)=>d.value==0?this.nullColor:colorScale(d.value))
              .transition()
              .duration(1000)
              .attr("cx", (d)=>barScale(d.value));

          // add the axes
          lollipopGraph.append("g")
              .attr("class", "lollipop-axis")
              .attr("transform", `translate(0,-${this.yScale.bandwidth()/2})`)
              .call(
                  axisTop(barScale)
                      .ticks(3)
              );

          lollipopGraph.append("text")
              .attr("id", "lolliLabel")
              .attr("x", 0)
              .attr("y", -40)
              .style("text-anchor", "end")
              .style("font-size", 9)
              .text("log10(TPM)"); // TODO: this should be a user-defined text

          lollipopGraph.append("g")
              .attr("class", "lollipop-axis")
              .attr("transform", `translate(0,-${this.yScale.bandwidth()/2})`)
              .call(
                  axisRight(this.yScale)
                    .tickValues([]) // show no ticks
              );

          // data label
          lollipopGraph.append("text")
              .attr("id", "lolliLabel")
              .attr("x", 10)
              .attr("y", -20)

              .text(`Isoform Expression in ${dataLabel}`)
              .style("text-anchor", "start")
              .style("font-size", "12px");


      }

      sortTracks(ylist){
          this.setYscale(this.config.h, ylist);
          this.render(true);
      }

      render(redraw=false, dom=undefined, labelOn='left', duration=1000){
          if (dom === undefined && this.visualDom === undefined) throw "Fatal Error: must provide a dom element";
          if (dom === undefined) dom = this.visualDom;
          else this.visualDom = dom;

          if(this.yScale===undefined) this.setYscale(this.config.h);

          const isoTracks = dom.selectAll(".isotrack")
              .data(this.isoforms.map((d)=>d.transcriptId));

          // update old isoform tracks, if any
          isoTracks.transition()
              .duration(duration)
              .attr("transform", (d)=>{ return `translate(0, ${this.yScale(d)})`});

          // update new tracks
          isoTracks.enter()
              .append("g")
              .attr("id", (d)=>(d.replace(".", "_")))
              .attr("class", "isotrack")
              .attr("transform", (d)=>{ return `translate(0, 0)`})

              // .merge(isoTracks)
              .transition()
              .duration(duration/2)
              .attr("transform", (d)=>{ return `translate(0, ${this.yScale(d)})`});

          if (redraw) return;

          this._renderModels(this.config.w, labelOn);

      }

      _renderModels(w, labelOn = 'left'){
          this.isoforms.forEach((isoform) => {
              const model = new GeneModel(isoform, this.modelExons, this.isoformExons[isoform.transcriptId], [], true);
              const isoformG = select(`#${isoform.transcriptId.replace(".", "_")}`);
              model.render(isoformG, {w:w, h: this.yScale.bandwidth(), labelOn: labelOn});
          });

      }

      setYscale(h, ylist=undefined){
          if (ylist === undefined) ylist = this.isoforms.map((d)=>d.transcriptId);
          this.yScale = band()
              .domain(ylist)
              .range([0, h])
              .padding(.05);
      }

  }

  /**
   * Render expression heatmap, gene model, and isoform tracks
   * @param type {enum} isoform, exon, junction
   * @param geneId {String} a gene name or gencode ID
   * @param rootId {String} the DOM ID of the SVG
   * @param urls {Object} of the GTEx web service urls with attr: geneId, tissue, geneModelUnfiltered, geneModel, junctionExp, exonExp
   */
  function render(type, geneId, rootId, urls=getGtexUrls()){
      json(urls.geneId + geneId) // query the gene by geneId--gene name or gencode ID with or without versioning
          .then(function(data){
               // get the gene object and its gencode Id
               if (!data.hasOwnProperty("gene")) throw "Parsing Error: attribute gene doesn't exist.";
               if (data.gene.length==0){
                   alert("No gene is found with " + geneId);
                   throw "Fatal Error: gene is not found";
               }
               if (data.gene.length>1) {
                   let filtered = data.gene.filter((g)=>{
                       return g.geneSymbolUpper==geneId.toUpperCase() || g.gencodeId == geneId.toUpperCase()
                   });
                   if (filtered.length > 1) {
                       alert("Fatal Error: input gene ID is not unique.");
                       throw "Fatal Error: input gene ID is not unique.";
                   }
                   else{
                       data.gene = filtered;
                   }
               }
               const gene = data.gene[0];
               if (gene === undefined) {
                   alert("No gene is found with " + geneId);
                   throw "Fatal Error: gene is not found";
               }
               const gencodeId = gene.gencodeId;

               // build the promises
               const promises = [
                  json(urls.tissue),
                  json(urls.geneModelUnfiltered + gencodeId),
                  json(urls.geneModel + gencodeId),
                  json(urls.transcript + gencodeId),
                  json(urls.junctionExp + gencodeId),
                  json(urls.exonExp + gencodeId),
                  json(urls.transcriptExp + gencodeId),
                  json(urls.exon + gencodeId)
               ];

               Promise.all(promises)
                   .then(function(args){
                      const tissues = parseTissues(args[0]),
                          exons = parseModelExons(args[1]), // exons of the full gene model
                          exonsCurated = parseModelExons(args[2]), // exons of the curated final gene model
                          isoforms = parseTranscripts(args[3]), // by default, the parser sorts the isoforms in descending order by length
                          isoformExons = parseExons(args[7]), // exons of the individual isoforms
                          junctions = parseJunctions(args[4]),
                          junctionExpress = parseJunctionExpression(args[4]),
                          exonExpress = parseExonExpression(args[5],  exonsCurated);
                      let isoformExpress = parseTranscriptExpression(args[6]);

                      // error checking
                      let exonColorScale, isoformColorScale, junctionColorScale;
                      if (junctions.length >= 0){
                          // scenario1: not a single-exon gene
                          if (junctionExpress !== undefined){
                              junctionColorScale = setColorScale(junctionExpress.map(d=>d.value), "Reds");
                          }
                      }

                      // define all the color scales
                      exonColorScale = setColorScale(exonExpress.map(d=>d.value), "Blues");
                      isoformColorScale = setColorScale(isoformExpress.map(d=>d.value), "Purples");

                  // heat map
                  let dmap = undefined;
                  const ids = {
                      root: rootId,
                      svg: `${rootId}-svg`,
                      tooltip: "isoformTooltip",
                      toolbar: "isoformToolbar",
                      clone: "isoformClone",
                      buttons: {
                          save: "isoformSave"
                      }
                  };
                  // build the dom components
                  if($(`#${ids.tooltip}`).length == 0) $('<div/>').attr('id', ids.tooltip).appendTo($('body'));
                  ["toolbar", "clone"].forEach((key)=>{
                      $('<div/>').attr("id", ids[key]).appendTo($(`#${ids.root}`));
                  });
                  const svgTitle = `${gene.geneSymbol}: ${gene.gencodeId} ${gene.description}`;
                  const width = $(`#${rootId}`).innerWidth()||window.innerWidth;
                 
                  switch(type){
                      case "isoformTransposed": {
                          const dmapConfig = new DendroHeatmapConfig(width, 150, 100, {top: 60, right: 350, bottom: 200, left: 50}, 12, 10);
                          // TODO: move cluster data parsing to gtexDataParser.js
                          ['tissue', 'transcript'].forEach((k)=>{
                              if(!args[6].clusters.hasOwnProperty(k)) {
                                  console.error(args[6].clusters);
                                  throw('Parse Error: Required cluster attribute is missing: ' + k);
                              }
                          });
                          let tissueTree = args[6].clusters.tissue;
                          let isoformTree = args[6].clusters.transcript;
                          let isoformExpressT = parseTranscriptExpressionTranspose(args[6]);

                          dmap = new DendroHeatmap(tissueTree, isoformTree, isoformExpressT, "Purples", 5, dmapConfig, true, 10, `Isoform Expression of ${svgTitle}`);
                          dmap.render(ids.root, ids.svg, true, true, top, 5);
                          if (!isoformTree.startsWith("Not enough data")){
                              const orders = dmap.objects.rowTree.yScale.domain(); // the leaf order of the isoform dendrogram
                              isoforms.sort((a, b)=>{
                                  if (orders.indexOf(a.transcriptId) < orders.indexOf(b.transcriptId)) return -1;
                                  if (orders.indexOf(a.transcriptId) > orders.indexOf(b.transcriptId)) return 1;
                                  return 0;
                              });
                          }

                          break;
                      }
                      case "junction": {
                          if (junctions.length == 0) {
                              $(`#${rootId}`).text('This gene has no junctions available.');
                              break;
                          }
                          const dmapConfig = new DendroHeatmapConfig(width, 150, 0, {top: 60, right: 350, bottom: 200, left: 50}, 12, 10);
                          let tissueTree = args[4].clusters.tissue;
                          dmap = new DendroHeatmap(undefined, tissueTree, junctionExpress, "Reds", 5, dmapConfig, true, 10, `Junction Expression of ${svgTitle}`);
                          dmap.render(ids.root, ids.svg, false, true, top, 5);

                          break;
                      }
                      case "exon": {
                          const dmapConfig = new DendroHeatmapConfig(width, 150, 0, {top: 60, right: 350, bottom: 200, left: 50}, 12, 10);
                          let tissueTree = args[5].clusters.tissue;
                          dmap = new DendroHeatmap(undefined, tissueTree, exonExpress, "Blues", 5, dmapConfig, true, 2, `Exon Expression of ${svgTitle}`);
                          dmap.render(ids.root, ids.svg, false, true, top, 5);

                          break;
                      }
                      default: {
                          throw "Input type is not recognized";
                      }
                  }
                  $('#spinner').hide();

                  // TODO: code review
                  // tooltip
                  dmap.createTooltip(ids.tooltip);

                  // define the gene model and isoform tracks layout dimensions
                  const yAdjust = type.startsWith('isoform')?60:80; // vertical space between the heatmap and gene model/isoform tracks
                  const modelConfig = {
                      x: dmap.config.panels.main.x,
                      y: dmap.config.panels.main.h + dmap.config.panels.main.y + yAdjust, // TODO: remove hard-coded values
                      w: dmap.config.panels.main.w,
                      h: 100
                  };

                  const exonH = 20; // TODO: remove hard-coded values
                  const isoTrackViewerConfig = {
                      x: modelConfig.x,
                      y: modelConfig.y + modelConfig.h,
                      w: modelConfig.w,
                      h: exonH*(isoforms.length),
                      labelOn: 'left'
                  };

                  // extend the SVG height to accommondate the gene model and isoform tracks
                  let h = +select(`#${ids.svg}`).attr("height"); // get the current height
                  let adjust = h + modelConfig.h + isoTrackViewerConfig.h;
                  if (!type.startsWith('isoform')) adjust = adjust < 1200?1200:adjust;
                  select(`#${ids.svg}`).attr("height", adjust); // set minimum height to 1200 for color legends // TODO: code review, remove hard-coded values

                  // render the gene model
                  const geneModel = new GeneModel(gene, exons, exonsCurated, junctions);
                  const modelG = dmap.visualComponents.svg.append("g").attr("id", "geneModel") // TODO: remove hard-coded id
                      .attr("transform", `translate(${modelConfig.x}, ${modelConfig.y})`);
                  if (!type.startsWith("isoform")) geneModel.render(modelG, modelConfig); // gene model is not rendered when the page is in isoform view mode

                  // render isoform tracks, ignoring intron lengths
                  const isoformTrackViewer = new IsoformTrackViewer(isoforms, isoformExons, exons, isoTrackViewerConfig);
                  const trackViewerG = dmap.visualComponents.svg.append("g")
                      .attr("transform", `translate(${isoTrackViewerConfig.x}, ${isoTrackViewerConfig.y})`);
                  const labelOn = type.startsWith('isoform')?'both':'left';
                  isoformTrackViewer.render(false, trackViewerG, labelOn);

                  // customization
                  if(!type.startsWith('isoform')) _addColorLegendsForGeneModel(dmap, junctionColorScale, exonColorScale);
                  _createToolbar(dmap, ids);

                  switch(type){
                      case "isoformTransposed": {
                          _customizeIsoformTransposedMap(tissues, dmap, isoformTrackViewer, junctionColorScale, exonColorScale, isoformColorScale, junctionExpress, exonExpress, isoformExpress);
                          _customizeIsoformTracks(dmap);
                          break;
                      }
                      case "junction": {
                          if (junctions.length == 0) break;
                          _customizeHeatMap(tissues, geneModel, dmap, isoformTrackViewer, junctionColorScale, exonColorScale, isoformColorScale, junctionExpress, exonExpress, isoformExpress);
                          _customizeJunctionMap(tissues, geneModel, dmap);
                          _customizeGeneModel(tissues, geneModel, dmap);
                          _customizeIsoformTracks(dmap);

                          break;
                      }
                      case "exon": {
                          _customizeHeatMap(tissues, geneModel, dmap, isoformTrackViewer, junctionColorScale, exonColorScale, isoformColorScale, junctionExpress, exonExpress, isoformExpress);
                          _customizeExonMap(tissues, geneModel, dmap);
                          _customizeGeneModel(tissues, geneModel, dmap);
                          _customizeIsoformTracks(dmap);

                          break;
                      }
                      default: {
                          throw "unrecognized type";
                      }
                  }
          }).catch(function(err){
              console.error(err);
              $('#spinner').hide();
          });
          })
          .catch(function(err){
              console.error(err);
              $('#spinner').hide();
          });
  }

  /**
   * Create the SVG toolbar
   * @param dmap {DendroHeatmap}
   * @param ids {Dictionary} of DOM IDs with buttons
   * @private
   */
  function _createToolbar(dmap, ids){
      let toolbar = dmap.createToolbar(ids.toolbar, dmap.tooltip);
      toolbar.createDownloadSvgButton(ids.buttons.save, ids.svg, `${ids.root}-save.svg`, ids.clone);
  }

  /**
   * customizing the heatmap
   * dependencies: CSS classes from expressMap.css, junctionMap.css
   * @param tissues {List} of GTEx tissue objects with attr: colorHex, tissueSiteDetailId, tissueSiteDetail
   * @param geneModel {GeneModel} of the collapsed gene model
   * @param dmap {Object} of DendroHeatmap
   * @param isoTrackViewer {IsoformTrackViewer}
   * @param junctionScale
   * @param exonScale
   * @param isoformScale
   * @param junctionData {List} of junction expression data objects
   * @param exonData {List} of exon expression data objects
   * @param isoformData {List} of isoform expression data objects
   * @private
   */
  function _customizeHeatMap(tissues, geneModel, dmap, isoTrackViewer, junctionScale, exonScale, isoformScale, junctionData, exonData, isoformData){
      const mapSvg = dmap.visualComponents.svg;
      const tissueDict = tissues.reduce((arr, d)=>{arr[d.tissueSiteDetailId] = d; return arr;},{});

      // replace tissue ID with tissue site detail
      mapSvg.selectAll(".exp-map-ylabel")
          .text((d)=>tissueDict[d]!==undefined?tissueDict[d].tissueSiteDetail:d)
          .style("cursor", "pointer")
          .attr("x", dmap.objects.heatmap.xScale.range()[1] + 15); // make room for tissue color boxes

      // add tissue bands
      mapSvg.select("#heatmap").selectAll(".exp-map-ycolor")
          .data(dmap.objects.heatmap.yScale.domain())
          .enter()
          .append("rect")
          .attr("x", dmap.objects.heatmap.xScale.range()[1] + 5)
          .attr("y", (d)=>dmap.objects.heatmap.yScale(d))
          .attr("width", 5)
          .attr("height", dmap.objects.heatmap.yScale.bandwidth())
          .classed("exp-map-ycolor", true)
          .style("fill", (d)=>`#${tissueDict[d].colorHex}`);

      if (dmap.objects.heatmap.xScale.domain().length > 15) {
          // Add an extra tissue color band if the number of columns are larger than 15
          mapSvg.select("#heatmap").selectAll(".leaf-color")
              .data(dmap.objects.heatmap.yScale.domain())
              .enter()
              .append("rect")
              .attr("x", dmap.objects.heatmap.xScale.range()[0] - 5)
              .attr("y", (d) => dmap.objects.heatmap.yScale(d))
              .attr("width", 5)
              .attr("height", dmap.objects.heatmap.yScale.bandwidth())
              .classed("leaf-color", true)
              .style("fill", (d) => `#${tissueDict[d].colorHex}`);
      }

      // define tissue label mouse events
      mapSvg.selectAll(".exp-map-ylabel")
          .on("mouseover", function(){
               select(this)
                  .classed('highlighted', true);

          })
          .on("click", function(d){
              mapSvg.selectAll(".exp-map-ylabel").classed("clicked", false);
              select(this).classed("clicked", true);
              const tissue = d;
              let j;
              if (junctionData !== undefined) j = junctionData.filter((j)=>j.tissueSiteDetailId==tissue); // junction data
              const ex = exonData.filter((e)=> e.tissueSiteDetailId==tissue); // exon data
              // geneModel.changeTextlabel(mapSvg.select("#geneModel"), tissueDict[tissue].tissueSiteDetail);
              geneModel.addData(mapSvg.select("#geneModel"), j, ex, junctionScale, exonScale);

              // isoforms update
              const isoBarScale = linear$1()
                  .domain([min(isoformData.map(d=>d.value)), max(isoformData.map(d=>d.value))])
                  .range([0, -100]);
              const isoData = isoformData.filter((iso)=>iso.tissueSiteDetailId==tissue);
              isoTrackViewer.showData(isoData, isoformScale, isoBarScale, tissueDict[tissue].tissueSiteDetail);
          });
  }

  /**
   *
   * @param tissues {List} of the GTEx tissue objects with attr: tissueSiteDetail
   * @param dmap {Object} of DendroHeatmap
   * @param isoTrackViewer {IsoTrackViewer}
   * @param junctionScale
   * @param exonScale
   * @param isoformScale
   * @param junctionData {List} of junction expression data objects
   * @param exonData {List} of exon expression data objects
   * @param isoformData {List} of isoform expression data objects
   * @private
   */
  function _customizeIsoformTransposedMap(tissues, dmap, isoTrackViewer, junctionScale, exonScale, isoformScale, junctionData, exonData, isoformData){
      const mapSvg = dmap.visualComponents.svg;
      const tissueDict = tissues.reduce((arr, d)=>{arr[d.tissueSiteDetailId] = d; return arr;},{});
      const tooltip = dmap.tooltip;

      //replace tissue site detail ID with tissue site detail
      mapSvg.selectAll(".exp-map-xlabel")
          .text((d)=>tissueDict[d]!==undefined?tissueDict[d].tissueSiteDetail:d)
          .style("cursor", "pointer");

      // add tissue bands
      mapSvg.select("#heatmap").selectAll(".exp-map-xcolor")
          .data(dmap.objects.heatmap.xScale.domain())
          .enter()
          .append("rect")
          .attr("x", (d)=>dmap.objects.heatmap.xScale(d))
          .attr("y", dmap.objects.heatmap.yScale.range()[1] + 5)
          .attr("width", dmap.objects.heatmap.xScale.bandwidth())
          .attr("height", 5)
          .classed("exp-map-xcolor", true)
          .style("fill", (d)=>`#${tissueDict[d].colorHex}`);

      if (dmap.objects.heatmap.yScale.domain().length > 15){
          // when there are more than 15 isoforms, add another tissue color bands under the dendrogram's leaf nodes
           mapSvg.select("#heatmap").selectAll(".leaf-color")
              .data(dmap.objects.heatmap.xScale.domain())
              .enter()
              .append("rect")
              .attr("x", (d)=>dmap.objects.heatmap.xScale(d))
              .attr("y", dmap.objects.heatmap.yScale.range()[0] - 10)
              .attr("width", dmap.objects.heatmap.xScale.bandwidth())
              .attr("height", 5)
              .classed("leaf-color", true)
              .style("fill", (d)=>`#${tissueDict[d].colorHex}`);
      }


      // define tissue label mouse events
      mapSvg.selectAll(".exp-map-xlabel")
          .on("mouseover", function(){
               select(this)
                  .classed('highlighted', true);

          })
          .on("mouseout", function(){
               select(this)
                  .classed('highlighted', false);

          })
          .on("click", function(d){
              mapSvg.selectAll(".exp-map-xlabel").classed("clicked", false);
              select(this).classed("clicked", true);
              const tissue = d;
              let j;
              if (junctionData !== undefined) j = junctionData.filter((j)=>j.tissueSiteDetailId==tissue); // junction data
              const ex = exonData.filter((e)=>e.tissueSiteDetailId==tissue); // exon data

              // isoforms update

              const isoBarScale = linear$1()
                  .domain([min(isoformData.map(d=>d.value)), max(isoformData.map(d=>d.value))])
                  .range([0, -100]);
              const isoData = isoformData.filter((iso)=>iso.tissueSiteDetailId==tissue);
              const sort = false;
              isoTrackViewer.showData(isoData, isoformScale, isoBarScale, tissueDict[tissue].tissueSiteDetail, sort);
          });



      // define the isoform heatmap cells' mouse events
      // note: to reference the element inside the function (e.g. d3.select(this)) here we must use a normal anonymous function.
      mapSvg.selectAll(".exp-map-cell")
          .on("mouseover", function(d){
              const selected = select(this); // 'this' refers to the d3 DOM object
              dmap.objects.heatmap.cellMouseover(selected);
              const tissue = tissueDict[d.x] === undefined?d.x:tissueDict[d.x].tissueSiteDetail; // get tissue name or ID
              const value = parseFloat(d.originalValue.toExponential()).toPrecision(3);
              tooltip.show(`Tissue: ${tissue}<br/> Isoform: ${d.id}<br/> ${d.unit}: ${value==0?'NA':value}`);
          })
          .on("mouseout", function(d){
              mapSvg.selectAll("*").classed('highlighted', false);
              tooltip.hide();
          });

      // isoform labels
      mapSvg.selectAll(".exp-map-ylabel")
          .on("mouseover", function(d){
              select(this).classed("highlighted", true);

              // highlight the isoform track
              const id = d.replace(".", "_"); // dot is not an allowable character, so it has been replaced with an underscore
              mapSvg.select(`#${id}`).selectAll(".exon-curated").classed("highlighted", true); // TODO: perhaps change the class name?
              mapSvg.select(`#${id}`).selectAll(".intron").classed("highlighted", true);
          })
          .on("mouseout", function(){
              select(this).classed("highlighted", false);
              mapSvg.selectAll(".exon-curated").classed("highlighted", false);
              mapSvg.selectAll(".intron").classed("highlighted", false);
          })
          .on ("click", function(){
              // no action implemented
          });

  }

  /**
   * customizing the exon heat map
   * @param tissues {List} of the GTEx tissue objects with attr: tissueSiteDetail
   * @param geneModel {GeneModel}
   * @param dmap {DendroHeatmap}

   * @private
   */
  function _customizeExonMap(tissues, geneModel, dmap){
      const mapSvg = dmap.visualComponents.svg;
      const tooltip = dmap.tooltip;
      const tissueDict = tissues.reduce((arr, d)=>{arr[d.tissueSiteDetailId] = d; return arr;},{});

      // define the exon heatmap cells' mouse events
      // note: to reference the element inside the function (e.g. d3.select(this)) here we must use a normal anonymous function.
      mapSvg.selectAll(".exp-map-cell")
          .on("mouseover", function(d){
              const selected = select(this); // 'this' refers to the d3 DOM object
              dmap.objects.heatmap.cellMouseover(selected);
              const tissue = tissueDict[d.y] === undefined?d.x:tissueDict[d.y].tissueSiteDetail; // get tissue name or ID
              const value = parseFloat(d.originalValue.toExponential()).toPrecision(3);
              tooltip.show(`Tissue: ${tissue}<br/> Exon: ${d.exonId}<br/> ${d.chromStart} - ${d.chromEnd} (${Number(d.chromEnd)-Number(d.chromStart) + 1}bp) <br/>${d.unit}: ${value==0?'NA':value}`);
          })
          .on("mouseout", function(d){
              mapSvg.selectAll("*").classed('highlighted', false);
              tooltip.hide();
          });

      // exon labels
      mapSvg.selectAll(".exp-map-xlabel")
          .each(function(d){
              // simplified the exon label
              const exonNumber = d.split("_")[1];
              select(this).text(`Exon ${exonNumber}`);
          })
          .on("mouseover", function(d){
              select(this).classed("highlighted", true);

              // highlight the exon on the gene model
              const exonNumber = d.split("_")[1];
              mapSvg.selectAll(`.exon-curated${exonNumber}`).classed("highlighted", true);
          })
          .on("mouseout", function(){
              select(this).classed("highlighted", false);
              mapSvg.selectAll(".exon-curated").classed("highlighted", false);
          });

  }

  /**
   * customizing the junction heat map
   * @param tissues {List} of the GTEx tissue objects with attr: tissueSiteDetail
   * @param geneModel {GeneModel}
   * @param dmap {DendroHeatmap}
   * @private
   */
  function _customizeJunctionMap(tissues, geneModel, dmap){
      const mapSvg = dmap.visualComponents.svg;
      const tooltip = dmap.tooltip;
      const tissueDict = tissues.reduce((arr, d)=>{arr[d.tissueSiteDetailId] = d; return arr;},{});

      // define the junction heatmap cells' mouse events
      mapSvg.selectAll(".exp-map-cell")
          .on("mouseover", function(d){
              const selected = select(this);
              dmap.objects.heatmap.cellMouseover(selected);
              const tissue = tissueDict[d.y] === undefined?d.x:tissueDict[d.y].tissueSiteDetail; // get tissue name or ID
              const junc = geneModel.junctions.filter((j)=>j.junctionId == d.x && !j.filtered)[0]; // get the junction display name
              const value = parseFloat(d.originalValue.toExponential()).toPrecision(3);
              tooltip.show(`Tissue: ${tissue}<br/> Junction: ${junc.displayName} (${Number(junc.chromEnd) - Number(junc.chromStart)} bp)<br/> ${d.unit}: ${value==0?'NA':value}`);
          })
          .on("mouseout", function(d){
              mapSvg.selectAll("*").classed('highlighted', false);
              tooltip.hide();
          });

       // junction labels
      mapSvg.selectAll(".exp-map-xlabel")
          .each(function(){
              // add junction ID as the dom id
              const xlabel = select(this);
              const jId = xlabel.text();
              xlabel.attr("id", `${jId}`);
              xlabel.classed(`junc${jId}`, true);

              // and then change the text to startExon-endExon format
              const junc = geneModel.junctions.filter((d)=>d.junctionId == `${jId}` && !d.filtered)[0];
              if (junc !== undefined) xlabel.text(junc.displayName);
          })
          .on("mouseover", function(){
              const jId = select(this).attr("id");
              select(this).classed("highlighted", true);

              // highlight the junction and its exons on the gene model
              mapSvg.selectAll(`.junc${jId}`).classed("highlighted", true);
              const junc = geneModel.junctions.filter((d)=>d.junctionId == jId && !d.filtered)[0];
              if (junc !== undefined) {
                  mapSvg.selectAll(`.exon${junc.startExon.exonNumber}`).classed("highlighted", true);
                  mapSvg.selectAll(`.exon${junc.endExon.exonNumber}`).classed("highlighted", true);
              }
          })
          .on("mouseout", function(){
              select(this).classed("highlighted", false);
              selectAll(".junc").classed("highlighted", false);
              selectAll(".junc-curve").classed("highlighted", false);
              mapSvg.selectAll(".exon").classed("highlighted", false);
          });


  }

  function _customizeGeneModel(tissues, geneModel, dmap){
      const mapSvg = dmap.visualComponents.svg;
      const tooltip = dmap.tooltip;
      const model = mapSvg.select('#geneModel');
      const tissueDict = tissues.reduce((arr, d)=>{arr[d.tissueSiteDetailId] = d; return arr;},{});
      // mouse events on the gene model
      mapSvg.selectAll(".junc")
          .on("mouseover", function(d){
              selectAll(`.junc${d.junctionId}`).classed("highlighted", true);
              tooltip.show(`${d.displayName}<br/>Junction ${d.junctionId} (${Number(d.chromEnd) - Number(d.chromStart) + 1} bp)`);
              console.log(d);

              if (d.startExon !== undefined){
                  model.selectAll(".exon").filter(`.exon${d.startExon.exonNumber}`).classed("highlighted", true);
                  model.selectAll(".exon").filter(`.exon${d.endExon.exonNumber}`).classed("highlighted", true);
              }

              // on the junction heat map, label the xlabel
              model.select(`.junc${d.junctionId}`).classed("highlighted", true)
                  .classed("normal", false);
          })
          .on("mouseout", function(d){
              selectAll(`.junc${d.junctionId}`).classed("highlighted", false);
              model.selectAll(".exon").classed("highlighted", false);
              model.selectAll(".xLabel").classed("highlighted", false)
                  .classed("normal", true);
              tooltip.hide();
          });
      model.selectAll(".exon-curated")
          .on('mouseover', function(d){
              select(this).classed("highlighted", true);
              tooltip.show(`Exon ${d.exonNumber}: ${d.chromStart} - ${d.chromEnd} (${d.chromEnd-d.chromStart+1} bp)`);
          })
          .on('mouseout', function(d){
              select(this).classed("highlighted", false);
              tooltip.hide();
          });
  }

  function _customizeIsoformTracks(dmap){
      const mapSvg = dmap.visualComponents.svg;
      const tooltip = dmap.tooltip;

      mapSvg.selectAll(".isotrack").selectAll('.exon-curated')
          .on("mouseover", function(d){
              select(this).classed("highlighted", true);
              tooltip.show(`Exon ${d.oriExon.exonNumber}: ${d.chromStart} - ${d.chromEnd} (${Number(d.chromEnd) - Number(d.chromStart) + 1} bp)`);
          })
          .on("mouseout", function(){
              select(this).classed("highlighted", false);
              mapSvg.selectAll(".exon-curated").classed("highlighted", false);
              tooltip.hide();
          });
  }

  function _addColorLegendsForGeneModel(dmap, junctionScale, exonScale){
      const mapSvg = dmap.visualComponents.svg;
      let X = dmap.objects.heatmap.xScale.range()[1] + 50;
      const Y = 30;
      const inc = 50;
      drawColorLegend("Exon read counts per base", mapSvg.select("#geneModel"), exonScale, {x: X, y:Y}, true, 5, 2, {h:20, w:10}, 'v');

      X = X + inc;
      if (junctionScale !== undefined) drawColorLegend("Junction read counts", mapSvg.select("#geneModel"), junctionScale, {x: X, y:Y}, true, 5, 10, {h:20, w:10}, 'v');

  }

  exports.render = render;

  return exports;

}({}));