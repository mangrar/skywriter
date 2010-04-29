/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an 'AS IS' basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is
 * Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"define metadata";
({
    "dependencies":
    {
        "traits": "0.0"
    },
    "description": "Simple support for multiple delegates on an object"
});
"end";

var SC = require('sproutcore/runtime').SC;
var Trait = require('traits').Trait;

/**
 * @namespace
 *
 * This mixin provides support for delegate objects. It's similar to
 * SC.DelegateSupport but is simpler and allows multiple delegates.
 */
exports.MultiDelegateSupport = {
    /**
     * @property{Array}
     *
     * The set of delegates.
     */
    delegates: [],

    /**
     * Adds a delegate to the list of delegates.
     */
    addDelegate: function(delegate) {
        this.set('delegates', this.get('delegates').concat(delegate));
    },

    /**
     * @protected
     *
     * For each delegate that implements the given method, calls it, passing
     * this object as the first parameter along with any other parameters
     * specified.
     */
    notifyDelegates: function(method) {
        var args = [ this ];
        for (var i = 1; i < arguments.length; i++) {
            args.push(arguments[i]);
        }

        this.get('delegates').forEach(function(delegate) {
            if (delegate.respondsTo(method)) {
                delegate[method].apply(delegate, args);
            }
        });
    },

    /**
     * Removes a delegate from the list of delegates.
     */
    removeDelegate: function(oldDelegate) {
        var delegates = this.get('delegates');
        this.set('delegates', delegates.filter(function(delegate) {
            return delegate !== oldDelegate;
        }));
    }
};

exports.DelegateTrait = Trait({
    /**
     * @property{Array}
     *
     * The set of delegates.
     */
    delegates: [],

    /**
     * Adds a delegate to the list of delegates.
     */
    addDelegate: function(delegate) {
        this.delegates = this.delegates.concat(delegate);
    },

    /**
     * @protected
     *
     * For each delegate that implements the given method, calls it, passing
     * this object as the first parameter along with any other parameters
     * specified.
     */
    notifyDelegates: function(method) {
        var args = [ this ];
        for (var i = 1; i < arguments.length; i++) {
            args.push(arguments[i]);
        }

        this.delegates.forEach(function(delegate) {
            if (delegate[method]) {
                delegate[method].apply(delegate, args);
            }
        });
    },

    /**
     * Removes a delegate from the list of delegates.
     */
    removeDelegate: function(oldDelegate) {
        this.delegates = this.delegates.filter(function(delegate) {
            return delegate !== oldDelegate;
        })
    }
});