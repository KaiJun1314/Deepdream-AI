(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
}((function () { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function attribute_to_object(attributes) {
        const result = {};
        for (const attribute of attributes) {
            result[attribute.name] = attribute.value;
        }
        return result;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement === 'function') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                const { on_mount } = this.$$;
                this.$$.on_disconnect = on_mount.map(run).filter(is_function);
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            disconnectedCallback() {
                run_all(this.$$.on_disconnect);
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
                const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
                callbacks.push(callback);
                return () => {
                    const index = callbacks.indexOf(callback);
                    if (index !== -1)
                        callbacks.splice(index, 1);
                };
            }
            $set($$props) {
                if (this.$$set && !is_empty($$props)) {
                    this.$$.skip_bound = true;
                    this.$$set($$props);
                    this.$$.skip_bound = false;
                }
            }
        };
    }

    /* src/FloatingChat.svelte generated by Svelte v3.38.3 */

    function create_fragment(ctx) {
    	let main;
    	let button;
    	let div0;

    	let t0_value = (/*opened*/ ctx[0]
    	? /*textclose*/ ctx[5]
    	: /*textopen*/ ctx[4]) + "";

    	let t0;
    	let t1;
    	let div1;
    	let iframe;
    	let iframe_src_value;
    	let button_title_value;
    	let button_aria_label_value;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			main = element("main");
    			button = element("button");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			iframe = element("iframe");
    			this.c = noop;
    			attr(div0, "class", "df-btn-text");
    			if (iframe.src !== (iframe_src_value = /*content*/ ctx[1])) attr(iframe, "src", iframe_src_value);
    			attr(iframe, "title", /*textopen*/ ctx[4]);
    			attr(iframe, "allow", "microphone *");
    			attr(div1, "class", "df-btn-content");

    			attr(button, "title", button_title_value = /*opened*/ ctx[0]
    			? /*textclose*/ ctx[5]
    			: /*textopen*/ ctx[4]);

    			attr(button, "aria-label", button_aria_label_value = /*opened*/ ctx[0]
    			? /*textclose*/ ctx[5]
    			: /*textopen*/ ctx[4]);

    			attr(button, "class", button_class_value = "df-btn " + (/*opened*/ ctx[0] ? "df-opened" : "df-closed"));
    			set_style(button, "--height", /*height*/ ctx[2]);
    			set_style(button, "--width", /*width*/ ctx[3]);
    			set_style(button, "--textcolor", /*textcolor*/ ctx[6]);
    			set_style(button, "--background", /*background*/ ctx[7]);
    			set_style(button, "--borderradius", /*borderradius*/ ctx[10]);
    			set_style(button, "--font", /*font*/ ctx[9]);
    			set_style(button, "--logo", /*logo*/ ctx[8]);
    			set_style(button, "--positiony", /*positiony*/ ctx[12]);
    			set_style(button, "--positionx", /*positionx*/ ctx[13]);
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, button);
    			append(button, div0);
    			append(div0, t0);
    			append(button, t1);
    			append(button, div1);
    			append(div1, iframe);

    			if (!mounted) {
    				dispose = listen(button, "click", /*toggle*/ ctx[11]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*opened, textclose, textopen*/ 49 && t0_value !== (t0_value = (/*opened*/ ctx[0]
    			? /*textclose*/ ctx[5]
    			: /*textopen*/ ctx[4]) + "")) set_data(t0, t0_value);

    			if (dirty & /*content*/ 2 && iframe.src !== (iframe_src_value = /*content*/ ctx[1])) {
    				attr(iframe, "src", iframe_src_value);
    			}

    			if (dirty & /*textopen*/ 16) {
    				attr(iframe, "title", /*textopen*/ ctx[4]);
    			}

    			if (dirty & /*opened, textclose, textopen*/ 49 && button_title_value !== (button_title_value = /*opened*/ ctx[0]
    			? /*textclose*/ ctx[5]
    			: /*textopen*/ ctx[4])) {
    				attr(button, "title", button_title_value);
    			}

    			if (dirty & /*opened, textclose, textopen*/ 49 && button_aria_label_value !== (button_aria_label_value = /*opened*/ ctx[0]
    			? /*textclose*/ ctx[5]
    			: /*textopen*/ ctx[4])) {
    				attr(button, "aria-label", button_aria_label_value);
    			}

    			if (dirty & /*opened*/ 1 && button_class_value !== (button_class_value = "df-btn " + (/*opened*/ ctx[0] ? "df-opened" : "df-closed"))) {
    				attr(button, "class", button_class_value);
    			}

    			if (dirty & /*height*/ 4) {
    				set_style(button, "--height", /*height*/ ctx[2]);
    			}

    			if (dirty & /*width*/ 8) {
    				set_style(button, "--width", /*width*/ ctx[3]);
    			}

    			if (dirty & /*textcolor*/ 64) {
    				set_style(button, "--textcolor", /*textcolor*/ ctx[6]);
    			}

    			if (dirty & /*background*/ 128) {
    				set_style(button, "--background", /*background*/ ctx[7]);
    			}

    			if (dirty & /*borderradius*/ 1024) {
    				set_style(button, "--borderradius", /*borderradius*/ ctx[10]);
    			}

    			if (dirty & /*font*/ 512) {
    				set_style(button, "--font", /*font*/ ctx[9]);
    			}

    			if (dirty & /*logo*/ 256) {
    				set_style(button, "--logo", /*logo*/ ctx[8]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	const component = get_current_component();
    	let { content } = $$props;
    	let { height = "600px" } = $$props;
    	let { width = "400px" } = $$props;
    	let { textopen = "Open" } = $$props;
    	let { textclose = "Close" } = $$props;
    	let { textcolor = "#000000" } = $$props;
    	let { background = "#FFFFFF" } = $$props;
    	let { logo } = $$props;
    	let { position = "bottom left" } = $$props;
    	let { font } = $$props;
    	let { borderradius = "28px" } = $$props;
    	let { opened = false } = $$props;
    	const positiony = position.split(" ")[0] === "top" ? "initial" : "0";
    	const positionx = position.split(" ")[1] === "left" ? "initial" : "0";

    	function open() {
    		$$invalidate(0, opened = true);
    		component?.dispatchEvent(new CustomEvent("open", { detail: null, composed: true }));
    	}

    	function close() {
    		$$invalidate(0, opened = false);
    		component?.dispatchEvent(new CustomEvent("close", { detail: null, composed: true }));
    	}

    	function toggle() {
    		opened ? close() : open();
    		component?.dispatchEvent(new CustomEvent("toggle", { detail: null, composed: true }));
    	}

    	$$self.$$set = $$props => {
    		if ("content" in $$props) $$invalidate(1, content = $$props.content);
    		if ("height" in $$props) $$invalidate(2, height = $$props.height);
    		if ("width" in $$props) $$invalidate(3, width = $$props.width);
    		if ("textopen" in $$props) $$invalidate(4, textopen = $$props.textopen);
    		if ("textclose" in $$props) $$invalidate(5, textclose = $$props.textclose);
    		if ("textcolor" in $$props) $$invalidate(6, textcolor = $$props.textcolor);
    		if ("background" in $$props) $$invalidate(7, background = $$props.background);
    		if ("logo" in $$props) $$invalidate(8, logo = $$props.logo);
    		if ("position" in $$props) $$invalidate(14, position = $$props.position);
    		if ("font" in $$props) $$invalidate(9, font = $$props.font);
    		if ("borderradius" in $$props) $$invalidate(10, borderradius = $$props.borderradius);
    		if ("opened" in $$props) $$invalidate(0, opened = $$props.opened);
    	};

    	return [
    		opened,
    		content,
    		height,
    		width,
    		textopen,
    		textclose,
    		textcolor,
    		background,
    		logo,
    		font,
    		borderradius,
    		toggle,
    		positiony,
    		positionx,
    		position,
    		open,
    		close
    	];
    }

    class FloatingChat extends SvelteElement {
    	constructor(options) {
    		super();

    		this.shadowRoot.innerHTML = `<style>.df-btn{padding:0;border:none;box-shadow:0 1px 2px 0 rgba(60,64,67,0.302),0 1px 3px 1px rgba(60,64,67,0.149);font-family:var(--font), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;background:var(--background);border-radius:var(--borderradius);cursor:pointer;transition:all .45s cubic-bezier(.4, 0, .2, 1);position:fixed;bottom:var(--positiony);left:var(--positionx);margin:16px;display:flex;flex-direction:column;z-index:999
  }.df-btn-text{min-width:56px;color:var(--textcolor);display:inline-flex;align-items:center;font-weight:500;padding:0 24px 0 0;font-size:.875rem;height:48px
  }.df-btn-text:before{min-width:56px;height:48px;background-position:center;background-repeat:no-repeat;background-size:24px;background-image:var(--logo);content:''
  }.df-btn:hover{box-shadow:0 1px 3px 0 rgba(60,64,67,0.302), 0 4px 8px 3px rgba(60,64,67,0.149)
  }.df-btn:not(.df-closed){border-radius:calc(var(--borderradius) / 2)
  }.df-btn:not(.df-closed)>.df-btn-text:before{background:var(--textcolor);-webkit-mask:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>') no-repeat center;mask:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>') no-repeat center
  }.df-btn-content{display:flex;align-self:flex-end;height:var(--height);width:var(--width);transition:all .45s cubic-bezier(.4, 0, .2, 1);opacity:1
  }.df-btn:not(.df-closed)>.df-btn-content{padding-bottom:16px}.df-btn-content iframe{height:100%;width:100%;border:none}.df-closed>.df-btn-content{width:0;height:0;opacity:0
  }@media screen and (max-width: 720px){.df-btn:not(.df-closed){margin:0px;border-radius:0px
    }.df-btn:not(.df-closed)>.df-btn-content{width:100vw;max-height:100vh;height:calc(100vh - 56px);padding-bottom:0px
    }.df-btn-text{padding:0;height:56px;font-size:0}}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				content: 1,
    				height: 2,
    				width: 3,
    				textopen: 4,
    				textclose: 5,
    				textcolor: 6,
    				background: 7,
    				logo: 8,
    				position: 14,
    				font: 9,
    				borderradius: 10,
    				opened: 0,
    				open: 15,
    				close: 16,
    				toggle: 11
    			}
    		);

    		if (options) {
    			if (options.target) {
    				insert(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return [
    			"content",
    			"height",
    			"width",
    			"textopen",
    			"textclose",
    			"textcolor",
    			"background",
    			"logo",
    			"position",
    			"font",
    			"borderradius",
    			"opened",
    			"open",
    			"close",
    			"toggle"
    		];
    	}

    	get content() {
    		return this.$$.ctx[1];
    	}

    	set content(content) {
    		this.$set({ content });
    		flush();
    	}

    	get height() {
    		return this.$$.ctx[2];
    	}

    	set height(height) {
    		this.$set({ height });
    		flush();
    	}

    	get width() {
    		return this.$$.ctx[3];
    	}

    	set width(width) {
    		this.$set({ width });
    		flush();
    	}

    	get textopen() {
    		return this.$$.ctx[4];
    	}

    	set textopen(textopen) {
    		this.$set({ textopen });
    		flush();
    	}

    	get textclose() {
    		return this.$$.ctx[5];
    	}

    	set textclose(textclose) {
    		this.$set({ textclose });
    		flush();
    	}

    	get textcolor() {
    		return this.$$.ctx[6];
    	}

    	set textcolor(textcolor) {
    		this.$set({ textcolor });
    		flush();
    	}

    	get background() {
    		return this.$$.ctx[7];
    	}

    	set background(background) {
    		this.$set({ background });
    		flush();
    	}

    	get logo() {
    		return this.$$.ctx[8];
    	}

    	set logo(logo) {
    		this.$set({ logo });
    		flush();
    	}

    	get position() {
    		return this.$$.ctx[14];
    	}

    	set position(position) {
    		this.$set({ position });
    		flush();
    	}

    	get font() {
    		return this.$$.ctx[9];
    	}

    	set font(font) {
    		this.$set({ font });
    		flush();
    	}

    	get borderradius() {
    		return this.$$.ctx[10];
    	}

    	set borderradius(borderradius) {
    		this.$set({ borderradius });
    		flush();
    	}

    	get opened() {
    		return this.$$.ctx[0];
    	}

    	set opened(opened) {
    		this.$set({ opened });
    		flush();
    	}

    	get open() {
    		return this.$$.ctx[15];
    	}

    	get close() {
    		return this.$$.ctx[16];
    	}

    	get toggle() {
    		return this.$$.ctx[11];
    	}
    }

    customElements.define("floating-chat", FloatingChat);

})));
