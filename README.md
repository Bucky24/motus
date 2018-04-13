# motus
Alternative to NPM

Motus is designed to run on the command line.

Existing commands:

install

env:[environment]

babel

# benefits over npm

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
This may not seem like a huge deal, but it adds up. As an example, Creating a test project that has babel-cli as a dependency, installed via npm, creates a node\_modules directory that is 28 MB.

Installing this same project through motus creates a motus cache directory of only 16 MB, and a project node\_modules directory of 4 KB. Installing 2 modules would give a size of 8 KB. Now imagine an engineer that has a dozen projects all that require high level complex modules like webpack, babel, and react. Downloading the repositiories and running npm install in each will create a dozen copies of the same code (which can be hundreds of mb). Installing using motus will install a single copy of each package, saving potentially GB of storage.