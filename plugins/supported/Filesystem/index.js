/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * See the License for the specific language governing rights and
 * limitations under the License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * ***** END LICENSE BLOCK ***** */

var SC = require("sproutcore/runtime").SC;
var util = require("bespin:util/util");
var pathUtil = require("path");

var NEW = exports.NEW = {name: "NEW"};
var LOADING = exports.LOADING = {name: "LOADING"};
var READY = exports.READY = {name: "READY"};

exports.Directory = SC.Object.extend({
    // the FileSource that is used for this directory
    source: null,
    
    // the parent of this directory, null if this is a root
    parent: null,
    
    // name of this directory -- does not include the parent segments
    name: null,
    
    // set of subdirectories
    directories: null,
    
    // set of files
    files: null,
    
    // whether or not we have data for this directory
    status: NEW,
    
    contents: function() {
        return this.get("directories").concat(this.get("files"));
    }.property('directories', 'files').cacheable(),
    
    init: function() {
        var source = this.get("source");
        if (typeof(source) == "string") {
            this.set("source", SC.objectForPropertyPath(source));
        }
        
        if (!this.get("source")) {
            throw "Directory must have a source.";
        }
        
        if (this.get("name") == null) {
            if (this.get("parent") != null) {
                throw "Directories must have a name, except for the root";
            }
            this.set("name", "/");
        }
        if (this.get("directories") == null) {
            this.set("directories", []);
        }
        if (this.get("files") == null) {
            this.set("files", []);
        }
    },
    
    /*
    * Populates this directory object asynchronously with data.
    * If everything goes well, onSuccess is called with this directory
    * object as the argument. Otherwise, onFailure is called with an
    * error object containing, at the least, "message".
    * 
    * Call loadDirectory on the FileSource with the parameters
    * path, directory handler delegate (this), and the onSuccess and onFailure
    * callbacks.
    */
    load: function(onSuccess, onFailure) {
        if (this.get("status") == READY) {
            onSuccess(this);
            return;
        }
        this.set("status", LOADING);
        var pr = this.get("source").loadDirectory(this);
        pr.then(function(data) {
            this.populateDirectory(data);
            if (typeof(onSuccess) == "function") {
                onSuccess(this);
            }
        }.bind(this),
        function(error) {
            if (typeof(onFailure) == "function") {
                onFailure({
                    message: error.toString(),
                    error: error,
                    directory: this
                });
            }
        }.bind(this));
    },
    
    /*
    * Retrieve the object at the path given, and load it (if it's
    * a directory)
    */
    loadPath: function(path, onSuccess, onFailure) {
        var obj = this._getObject(path);
        if (obj == null) {
            onFailure({
                message: "Cannot find " + path
            });
            return;
        }
        if (pathUtil.isDir(path)) {
            obj.load(onSuccess, onFailure);
        } else {
            onSuccess(obj);
        }
    },
    
    _getItem: function(name) {
        var isDir = util.endsWith(name, "/");
        var collection;
        if (isDir) {
            collection = this.get("directories");
        } else {
            collection = this.get("files");
        }
        return collection.findProperty("name", name);
    },
    
    /*
    * Retrieves an object (File or Directory) under this Directory
    * at the path given. If necessary, it will create objects along
    * the way.
    */
    _getObject: function(path) {
        var segments = path.split("/");
        var isDir = pathUtil.isDir(path);
        if (isDir) {
            segments.pop();
        }
        var curDir = this;
        for (var i = 0; i < segments.length - 1; i++) {
            var segment = segments[i] + "/";
            var nextDir = curDir._getItem(segment);
            if (nextDir == null) {
                // When the directory has been loaded, if
                // we don't know about the given name,
                // we're not going to create it.
                if (curDir.get("status") == READY) {
                    return null;
                }
                nextDir = exports.Directory.create({
                    source: curDir.get("source"),
                    name: segment,
                    parent: curDir
                });
                curDir.get("directories").push(nextDir);
            }
            curDir = nextDir;
        }
        
        var lastSegment = segments[i];
        if (isDir) {
            lastSegment += "/";
        }
        var retval = curDir._getItem(lastSegment);
        if (!retval) {
            if (curDir.get("status") == READY) {
                return null;
            }
            if (isDir) {
                retval = exports.Directory.create({
                    name: lastSegment,
                    source: curDir.get("source"),
                    parent: curDir
                });
                curDir.get("directories").push(retval);
            } else {
                retval = exports.File.create({
                    name: lastSegment,
                    directory: curDir
                });
                curDir.get("files").push(retval);
            }
        }
        return retval;
    },
    
    path: function() {
        var parent = this.get("parent");
        if (parent) {
            return pathUtil.combine(parent.get("path"), this.get("name"));
        }
        return this.get("name");
    }.property().cacheable(),
    
    /*
    * The originPath finds the path within the same file source.
    * So, if you have a hierarchy of directories built from different
    * sources, this path is guaranteed to only include the parts of
    * the path from the same source as this directory.
    * 
    * If you're looking up a file on a server, for example, you would
    * use this path.
    * 
    * At the moment, originPath is not truly implemented (it just returns
    * the path). However, filesources should use this.
    */
    originPath: function() {
        return this.get("path");
    }.property().cacheable(),
    
    toString: function() {
        return "Directory " + this.get("name");
    },
    
    /*
    * Generally by a FileSource to put the data in this Directory.
    * It contains an array of objects. Each one needs to minimally have
    * a name. If the name ends with "/" it is assumed to be a directory.
    * Object references will be properly filled in (parent and source
    * on directories, directory on files).
    */
    populateDirectory: function(data) {
        this.set("status", READY);
        var files = [];
        var directories = [];
        var source = this.get("source");
        data.forEach(function(item) {
            if (!item.name) {
                console.error("Bad data, no directory/file name: ", item);
                return;
            }
            if (util.endsWith(item.name, "/")) {
                item.parent = this;
                item.source = source;
                directories.push(exports.Directory.create(item));
            } else {
                item.directory = this;
                files.push(exports.File.create(item));
            }
        });
        this.set("directories", directories);
        this.set("files", files);
    }
});

exports.File = SC.Object.extend({
    // the directory this belongs to
    directory: null,
    
    // name of this file, does not include directory
    name: null
});


/**
 * This abstracts the remote Web Service file system, and in the future local
 * file systems too.
 * It ties into the bespin.client.Server object for remote access.
 */
exports.FileSystemOld = SC.Object.extend({
    /** The name of the project that contains the users client side settings */
    userSettingsProject: "BespinSettings",

    /**
     * Create a new file in the file system.
     * @param project is the name of the project to create the file in
     * @param path is the full path to save the file into
     * @param onSuccess is a callback to fire if the file is created
     */
    newFile: function(project, path, onSuccess, onFailure) {
        var self = this;
        this.whenFileDoesNotExist(project, path, {
            execute: function() {
                if (editSession.shouldCollaborate()) {
                    editSession.startSession(project, path || "new.txt", onSuccess, onFailure);
                } else {
                    // alert the system that a path has changed
                    hub.publish("path:changed", {
                        project: project,
                        path: path
                    });

                    editSession.setReadOnlyIfNotMyProject(project);

                    onSuccess({
                        name: path,
                        content: "",
                        timestamp: new Date().getTime()
                    });
                }
            },
            elseFailed: function() {
                if (util.isFunction(onFailure)) {
                    onFailure({ responseText:"The file " + path + " already exists my friend." });
                }
                throw "The file " + path + " already exists my friend.";
            }
        });
    },

    /**
     * Retrieve the contents of a file (in the given project and path) so we can
     * perform some processing on it. Called by editFile() if collaboration is
     * turned off.
     * @param project is the name of the project that houses the file
     * @param path is the full path to load the file into
     * @param onSuccess is a callback to fire if the file is loaded
     */
    loadContents: function(project, path, onSuccess, onFailure) {
        server.loadFile(project, path, function(content) {
            if (/\n$/.test(content)) {
                content = content.substr(0, content.length - 1);
            }

            onSuccess({
                name: path,
                content: content,
                timestamp: new Date().getTime()
            });
        }, onFailure);
    },

    /**
     * Load the file in the given project so we can begin editing it.
     * This loads the file contents via collaboration, so the callback will not
     * know what the
     * @param project is the name of the project that houses the file
     * @param path is the full path to load the file into
     * @param onSuccess is a callback to fire if the file is loaded
     */
    editFile: function(project, path, onSuccess, onFailure) {
        if (editSession.shouldCollaborate()) {
            editSession.startSession(project, path, onSuccess, onFailure);
        } else {
            var localOnSuccess = function() {
                editSession.setReadOnlyIfNotMyProject(project);
                onSuccess.apply(null, arguments);
            };
            this.loadContents(project, path, localOnSuccess, onFailure);
        }
    },

    /**
     * Open a file and eval it in a given scope
     */
    evalFile: function(project, filename, scope) {
        scope = scope || defaultScope();

        if (!project || !filename) {
            throw "Please, I need a project and filename to evaulate";
        }

        this.loadContents(project, filename, function(file) {
            // wow, using with. crazy.
            with (scope) {
                try {
                    eval(file.content);
                } catch (e) {
                    throw "There is a error trying to run " + filename + " in project " + project + ": " + e;
                }
            }
        }, true);
    },

    /**
     * Return a JSON representation of the projects that the user has access too
     * @param callback is a callback that fires given the project list
     */
    projects: function(callback) {
        server.projects(callback);
    },

    /**
     * Return a JSON representation of the files at the root of the given project
     * @param callback is a callback that fires given the files
     */
    fileNames: function(project, callback) {
        server.list(project, "", callback);
    },

    /**
     * Save a file to the given project
     * @param project is the name of the project to save into
     * @param file is the file object that contains the path and content to save
     */
    saveFile: function(project, file, onSuccess, onFailure) {
        // Unix files should always have a trailing new-line; add if not present
        if (/\n$/.test(file.content)) {
            file.content += "\n";
        }

        server.saveFile(project, file.name, file.content, file.lastOp, {
            onSuccess: function() {
                console.log("File saved: " + project + " " + file.name);
                hub.publish("file:saved", { project: project, path: file.name });
                if (util.isFunction(onSuccess)) {
                    onSuccess();
                }
            },
            onFailure: onFailure
        });
    },

    /**
     * Create a directory
     * @param project is the name of the directory to create
     * @param path is the full path to the directory to create
     * @param onSuccess is the callback to fire if the make works
     * @param onFailure is the callback to fire if the make fails
     */
    makeDirectory: function(project, path, onSuccess, onFailure) {
        var publishOnSuccess = function(result) {
            hub.publish("directory:created", {
                project: project,
                path: path
            });
            onSuccess(result);
        };
        server.makeDirectory(project, path, publishOnSuccess, onFailure);
    },

    /**
     * Remove a directory
     * @param project is the name of the directory to remove
     * @param path is the full path to the directory to delete
     * @param onSuccess is the callback to fire if the remove works
     * @param onFailure is the callback to fire if the remove fails
     */
    removeDirectory: function(project, path, onSuccess, onFailure) {
        var publishOnSuccess = function(result) {
            hub.publish("directory:removed", {
                project: project,
                path: path
            });
            onSuccess(result);
        };
        server.removeFile(project, path, publishOnSuccess, onFailure);
    },

    /**
     * Remove the file from the file system
     * @param project is the name of the project to delete the file from
     * @param path is the full path to the file to delete
     * @param onSuccess is the callback to fire if the remove works
     * @param onFailure is the callback to fire if the remove fails
     */
    removeFile: function(project, path, onSuccess, onFailure) {
        var publishOnSuccess = function(result) {
            hub.publish("file:removed", {
                project: project,
                path: path
            });
            onSuccess(result);
        };
        server.removeFile(project, path, publishOnSuccess, onFailure);
    },

    /**
     * Close the open session for the file
     * @param project is the name of the project to close the file from
     * @param path is the full path to the file to close
     * @param callback is the callback to fire when closed
     */
    closeFile: function(project, path, callback) {
        server.closeFile(project, path, callback);
    },

    /**
     * Check to see if the file exists and then run the appropriate callback
     * @param project is the name of the project
     * @param path is the full path to the file
     * @param callbacks is the pair of callbacks:
     *   execute (file exists)
     *   elseFailed (file does not exist)
     */
    whenFileExists: function(project, path, callbacks) {
        var onSuccess = function(files) {
            var hasSome = files.some(function(file) {
                return file.name == path;
            });

            if (files && hasSome) {
                callbacks.execute();
            } else {
                if (callbacks["elseFailed"]) {
                    callbacks.elseFailed();
                }
            }
        };

        var onFailure = function(xhr) {
            if (callbacks["elseFailed"]) {
                callbacks.elseFailed(xhr);
            }
        };

        server.list(project, path.directory(path), onSuccess, onFailure);
    },

    /**
     * The opposite of exports.whenFileExists()
     * @param project is the name of the project
     * @param path is the full path to the file
     * @param callbacks is the pair of callbacks:
     *   execute (file does not exist)
     *   elseFailed (file exists)
     */
    whenFileDoesNotExist: function(project, path, callbacks) {
        var onSuccess = function(files) {
            var hasSome = files.some(function(file) {
                return (file.name == path);
            });

            if (!files || !hasSome) {
                callbacks.execute();
            } else {
                if (callbacks["elseFailed"]) {
                    callbacks.elseFailed();
                }
            }
        };

        var onFailure = function(xhr) {
            // the list failed which means it didn't exist
            callbacks.execute();
        };

        server.list(project, path.directory(path), onSuccess, onFailure);
    }
});


var _defaultScope = null;

/**
 * Return a default scope to be used for evaluation files
 */
var defaultScope = function() {
    if (_defaultScope) {
        return _defaultScope;
    }

    var _defaultScope = {
        include: function(file) {
            files.evalFile(files.userSettingsProject, file);
        },
        require: require,
        execute: function(cmd) {
            cliController.executeCommand(cmd);
        }
    };

    [ "editor", "files", "server" ].forEach(function(id) {
        _defaultScope.id = this[id];
    });

    return _defaultScope;
};