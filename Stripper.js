/**
 * LinkStripper
 * Strips junk parameters from URLs.
 *
 * @namespace F7201EA2635711E3A4E04397A24410D2
 * @copyright (c) 2013 kafene software <http://kafene.org/>
 * @license Unlicensed/Public Domain <http://unlicense.org/>
 */
(function (scope, name, definition) {
    if ('undefined' != typeof(module) && module.exports) {
        module.exports = definition();
    } else if ('function' == typeof('define') && define.amd) {
        define(definition);
    } else if (scope instanceof window.Window || scope instanceof Window) {
        if ('object' == typeof(window.wrappedJSObject)) {
            window.wrappedJSObject[name] = definition();
        } else if ('object' == typeof(unsafeWindow)) {
            unsafeWindow[name] = definition();
        } else if (window.opera) {
            window.opera.defineMagicVariable(name, function () {
                return definition();
            }, null);
        }
        scope[name] = definition();
    } else {
        scope[name] = definition();
    }
})(this, 'LinkStripper', function () {

    // Escape string for use in regex
    // To avoid exceptions from RegExp() and account for '.'=>'\.' in hosts
    var regExpEscape = function (str) {
        return str.replace(/[\\.\+*?\[^\]$(){}=!<>|:\-]/g, '\\$&');
    };

    var parseUrl = function (url) {
        url = String(url);
        var a = document.createElement('a');
        a.href = url;
        return a;
    };

    // redirect client
    var redirectTo = function (url) {
        window.location.replace && window.location.replace(url);
        window.location.assign && window.location.assign(url);
        window.navigate && window.navigate(url);
        window.location.href = url;
        window.location = url;
    };

    // Convert to string, lowercase,
    // Strip out prefix like www., ww32., www2., etc.
    var normalizeHostname = function (hn) {
        return String(hn).toLowerCase().replace(/^(www)|(www?\d+)?\./, '');
    };

    // @param object rules (optional) - see this.prototype.rules for format.
    function LinkStripper(rules) {
        if ('object' == typeof (rules)) {
            this.rules = rules;
        }
    }

    // Default rule set given to instances constructed without a `rules` param.
    // Special key '__GLOBAL__' applies to all sites.
    // Other keys should be lowercase hostnames with or without subdomains
    // and port numbers. Include either optionally, to increase specificity.
    LinkStripper.prototype.rules = {
        '__GLOBAL__': [
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
        'youtube.com': ['feature'],
        'facebook.com': ['ref','fref','hc_location'],
        'imdb.com': ['ref_'],
        'chrome.google.com': ['hl'],
        'addons.opera.com': ['display','language'],
        'addons.mozilla.org': ['src']
    };

    // Matches host like 'google.com:4040' against 'google.com',
    // or 'mail.google.com' against 'google.com',
    // allowing sort of fuzzy matches against rule hosts.
    // Can be used to check if URLs will match before creating rules.
    LinkStripper.prototype.hostMatches = function (testHost, webHost) {
        webHost = webHost || window.location.host;
        if (testHost == webHost) return true;
        testHost = regExpEscape(testHost);
        var re = new RegExp('(^|\.)'+ testHost +'(:|$)', 'ig');
        return re.test(webHost);
    };

    /**
     * Get rules for the given host.
     *
     * @param string host
     */
    LinkStripper.prototype.getRules = function (host) {
        var self = this, rules = this.rules['__GLOBAL__'];
        for (var i in this.rules) {
            if ('__GLOBAL__' != i && self.hostMatches(i, host)) {
                rules = rules.concat(self.rules[i]);
            }
        }
        return rules && rules.length > 0 ? rules : null;
    };

    /**
     * Strips a given URL's query string of unwanted keys.
     *
     * @param string url - a full url (optional, otherwise window.location is used)
     */
    LinkStripper.prototype.stripUrl = function (url) {
        if (url && !/\/\//.test(url)) return url;
        url = url ? parseUrl(url) : window.location;
        var rules = this.getRules(url.hostname);
        if (!rules) return url.href;
        rules = rules.map(regExpEscape).join('|');
        var re = new RegExp('(^|[?&]+)(' + rules + ')=?[^&]*', 'ig');
        url.search = url.search.replace(re, '').replace(/^[?&]+|[?&]*$/g, '');
        return url.href.replace(/[?&#]*$/, '');
    };

    /**
     * Runs LinkStripper.stripUrl against the currently loaded url
     * This will result in a redirect if the url is modified.
     */
    LinkStripper.prototype.stripLocation = function () {
        var strippedUrl = this.stripUrl(window.location.href);
        if (window.location.href != strippedUrl) {
            redirectTo(strippedUrl);
        }
        return strippedUrl;
    };

    /**
     * Runs LinkStripper.stripUrl on all links in the document, as well as
     * any newly inserted <A> tags with an href attribute.
     */
    LinkStripper.prototype.stripLinks = function () {
        var self = this;

        var run = function run(node) {
            if (!node) return;
            if (node instanceof window.Event) {
                if (!node.target) return;
                node = node.target;
            }
            if (node.href) { // && node instanceof window.HTMLAnchorElement) {
                node.href = self.stripUrl(node.href);
            }
            if (node.querySelectorAll) {
                [].forEach.call(node.querySelectorAll('a[href]'), run);
            }
        };
        document.addEventListener('DOMNodeInserted', run);
        if (/^loaded|c/i.test(document.readyState)) {
            run(document.documentElement);
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                run(document.documentElement);
            });
        }
    };

    // Run a series of self-tests to make sure everything is working properly.
    LinkStripper.selfTest = function () {
        var run = function runTest(description, original, expected, got) {
            ((got = new LinkStripper().stripUrl(original)) == expected)?
                console.info("["+ description +"]: passed"):
                console.warn("["+ description +"]: failed\n" +
                            "Original: " + original + "\n" +
                            "Expected: " + expected + "\n" +
                            "Got: " + got);
        };
        run('Strip from complicated url',
            'https://encrypted.google.com/search?q=test&utm_source=blah&foo#bar',
            'https://encrypted.google.com/search?q=test&foo#bar');
        run('Strip not tricked by fragment',
            'http://www.google.com/search?utm_campaign=testing&foo=bar#utm_term=baz',
            'http://www.google.com/search?foo=bar#utm_term=baz');
        run('Strip from a non-global rule',
            'http://youtube.com/?v=12345&feature=youtube-gdata',
            'http://youtube.com/?v=12345');
        run('Strip from rule found by partial match (subdomain)',
            'http://videos.youtube.com/?v=12345&feature=youtube-gdata',
            'http://videos.youtube.com/?v=12345');
        run('Strip from rule found by partial match (subdomain) with a port number.',
            'http://videos.youtube.com:4040/?v=12345&feature=youtube-gdata',
            'http://videos.youtube.com:4040/?v=12345');
    };

    return LinkStripper;
});
