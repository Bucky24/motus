# motus
Alternative to NPM

Motus is designed to run on the command line.

Existing commands:

```
install - installs a module from package.json
env:[environment] - sets the environment for motus
babel - runs a standard babel parser over all found js files
```

# Installing and using

I don't have an install script right now, will make one soon. I currently use an alias to be able to cheaply run the command:

    alias motus='node <path to motus repo>/main.js'

Everything typed after the "motus" is considered a command that will be executed in sequence. For instance, to install a project, including developer packages:

    motus env:development install

To run babel over a project:

    motus babel

To do both in one sitting:

    motus env:development install babel

The command system is meant to be very easy to use and to get projects off the ground quickly without having to set up larger systems like webpack.

# Benefits over NPM

The first major benefit over npm is that motus does not place packages inside the node\_modules directory itself. Instead, it uses symlinks, placing the packages inside a cache directory. Why do this?

Imagine you have a project that relies on module A and module C. Module A also relies on module B which ALSO relies on module C. The way npm installs packages, you'll get something like this:

```node\_modules
    |- A
       |- node\_modules
           |- B
              |- node\_modules
                 |- C
    |- C
```	
motus will do something like so:
```
cache
   |- A
       | - node\_modules
           |- B (symlink)
   |- B
       | - node\_modules
           |- C (symlink)
   |- C
```
and in the project:
```
node\_modules
    |- A (symlink)
    |- B (symlink)
```	
This may not seem like a huge deal, but it adds up.

As an example, creating a test project that has babel-cli as a dependency, installed via npm, creates a node\_modules directory that is 28 MB. Installing this same project through motus creates a motus cache directory of only 16 MB, and a project node\_modules directory of 4 KB (the size of the single file that tracks the symlink).

```
testCode$ cat package.json
{
    "dependencies": {
        "babel-cli": "6.23.0"
    }
}
testCode$ npm install
... trimmed log ...
added 234 packages in 4.493s
testCode$ du -sh node_modules/
 28M	node_modules/
testCode$ rm -rf node_modules/
testCode$ motus install
... trimmed log ...
testCode$ du -sh node_modules/
4.0K	node_modules/
testCode$ du -sh ~/.motus/cache
 16M	/Users/robbert/.motus/cache
```

Now imagine an engineer that has a dozen projects all that require high level complex modules like webpack, babel, and react. Downloading the repositiories and running npm install in each will create a dozen copies of the same module code (which can be hundreds of mb). Installing using motus will install a single copy of each package, saving potentially GB of storage.