(function (window) {
    var document = window.document;

    // function to escape string for regexp:
    var regExpEscape;
    regExpEscape = function (str) {
        return (str + '').replace(/[\\.\+*?\[^\]$(){}=!<>|:\-]/g, '\\$&');
    };

    // Execute a callback once document.readyState is complete.
    var onDomReady;
    onDomReady = function (callback) {
        var state = document.readyState;
        return ('complete' == state || 'interactive' == state) ?
            callback() :
            window.setTimeout(onDomReady, 9, callback);
    };

    var onLocationReady;
    onLocationReady = function (callback) {
        return (window && window.location) ?
            callback() :
            window.setTimeout(onLocationReady, 9, callback);
    };

    var runTest;
    runTest = function (description, callback) {
        if (callback()) {
            console.log('[' + description + ']: passed.');
        } else {
            console.warn('[' + description + ']: failed.');
        }
    };

    var defaultRules = {
        'global': [
            'utm_source',
            'utm_medium',
            'utm_term',
            'utm_content',
            'utm_campaign',
            'yclid',
            'fb_action_ids',
            'fb_action_types',
            'fb_ref',
            'fb_source',
            'action_object_map',
            'action_type_map',
            'action_ref_map'
        ],

        'youtube.com': [
            'feature'
        ],

        'facebook.com': [
            'ref',
            'fref',
            'hc_location'
        ],

        'imdb.com': [
            'ref_'
        ],

        'chrome.google.com': [
            'hl'
        ],

        'addons.opera.com': [
            'display'
        ],

        'addons.mozilla.org': [
            'src'
        ]
    };

    // Stripper
    var Stripper = function (rules) {
        var self = this;

        // Use default rules unless some were passed in as an argument.
        self.rules = rules || self.getDefaultRules();

        /*
         * Chainable setter for rules.
         */
        self.setRules = function (rules) {
            self.rules = rules;

            return self;
        };

        /*
         * @param string Hostname, lowercase, stripped of 'www.' and port.
         * @return RegExp - concatted rule array joined by | and regex escaped.
         */
        self.getRules = function (name) {
            // Use the global rule set as base rules
            var rules = self.rules['global'];
            var ruleName;

            for (ruleName in self.rules) {
                if ('global' == ruleName) {
                    continue;
                }

                // Direct match
                if (name == ruleName) {
                    rules = rules.concat(self.rules[ruleName]);
                    continue;
                }

                // Match against partial name (e.g. rule name is 'foo.com', match with 'bar.foo.com')
                if ((new RegExp('(^|\.)' + regExpEscape(ruleName) + '(:|$)', 'ig')).test(name)) {
                    rules = rules.concat(self.rules[ruleName]);
                }
            }

            // No rules found
            if (0 === rules.length) {
                return null;
            }

            rules = rules.map(regExpEscape).join('|');
            return new RegExp('(^|&)(' + rules + ')=?[^&]*', 'ig');
        };

        /*
         * Strips the crap from URLs.
         */
        self.stripUrl = function (url) {
            url = (url || window.location.href) + '';

            if (!/:\/\//.exec(url)) {
                return url;
            }

            var a = document.createElement('a');
                a.href = url;
            var host = a.hostname;
            var query = a.search;

            host = host.toLowerCase().replace(/^www\./, '');
            query = query.replace(/^\?/, ''); // Strip leading '?'

            var stripRegex = self.getRules(host);
            if (stripRegex) {
                a.search = '?' + query.replace(stripRegex, '').replace(/^[&]+/, '');
            }

            // Fix dangling '?' or '&'
            a.href = a.href.replace(/[?&]*$/, '');

            return a.href;
        };

        /*
         * Runs Stripper.stripUrl against the current url
         * Will result in a redirect if the url is stripped of junk.
         */
        self.stripLocation = function () {
            onLocationReady(function () {
                var locationHref = window.location.href;
                var locationStripped = self.stripUrl(locationHref);

                if (locationHref != locationStripped) {
                    window.location.href = locationStripped;
                }
            });
        };

        /*
         * Runs Stripper.stripUrl on all links in the document, as well as
         * any newly inserted nodes which can be queried or have an href
         * attribute.
         */
        self.stripLinks = function () {
            var stripLinks = function (target) {
                target = target || document;

                [].forEach.call(target.querySelectorAll('[href]'), function (a) {
                    a.href = self.stripUrl(a.href);
                });
            };

            onDomReady(stripLinks);

            document.addEventListener('DOMNodeInserted', function (e) {
                if (e.target) {
                    if (e.target.querySelectorAll) {
                        stripLinks(e.target);
                    }
                    if (e.target.href) {
                        e.target.href = self.stripUrl(e.target.href);
                    }
                }
            });
        };
    };

    /*
     * Returns the default (unalterable) rule set
     */
    Stripper.prototype.getDefaultRules = function () {
        return defaultRules;
    };

    /*
     * Make sure everything works alright.
     */
    Stripper.prototype.selfTest = function () {
        runTest('Strip from complicated url', function () {
            var original = 'https://encrypted.google.com/search?q=test&utm_source=blah&foo#bar';
            var expected = 'https://encrypted.google.com/search?q=test&foo#bar';

            return Stripper.new().stripUrl(original) == expected;
        });

        runTest('Strip not tricked by fragment', function () {
            var original = 'http://www.google.com/search?utm_campaign=testing&foo=bar#utm_term=baz';
            var expected = 'http://www.google.com/search?foo=bar#utm_term=baz';

            return Stripper.new().stripUrl(original) == expected;
        });

        runTest('Strip from a non-global rule', function () {
            var original = 'http://youtube.com/?v=12345&feature=youtube-gdata';
            var expected = 'http://youtube.com/?v=12345';

            return Stripper.new().stripUrl(original) == expected;
        });

        runTest('Strip from a non-global rule found by partial match (subdomain)', function () {
            var original = 'http://videos.youtube.com/?v=12345&feature=youtube-gdata';
            var expected = 'http://videos.youtube.com/?v=12345';

            return Stripper.new().stripUrl(original) == expected;
        });
    };

    /*
     * Makes getting a new instance for chaining a bit easier.
     */
    Stripper.new = function (rules) {
        return new Stripper(rules);
    };

    window['Stripper'] = Stripper;
})(this);
