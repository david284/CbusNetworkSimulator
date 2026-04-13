# CbusNetworkSimulator

This application simulates most types of modules that can exist on a CBUS/VLCB network, and would be used instead of a physical connection.
It presents itself on the usual network port 5550, so can accept connections from any application that can use a network connection for the CBUS connection (e.g. MMC, FCU or JMRI).
It was primarily intended to allow testing of various features of the Module Management Console (MMC).
One of it's advantages is that a new module type can be quickly added, as they all inherit from a base module class, so each module has very little code.
You can change some of the default settings - see layout.js below.

## Node.js

This application requires Node.js (& npm) to run.
Useful guide to installing NodeJS ->https://www.pluralsight.com/resources/blog/guides/getting-started-with-nodejs.
Get Node.js from -> https://nodejs.org/en/download/package-manager/

## Installation

Assuming node.js is installed (if not, then see above & install it)
Either unzip a copy (zip file) or clone the github repository to a folder of your choice
Then, from that folder, run 'npm install' - this will install all the dependancies for the application

## Running

To run the application, just use 'npm run' from the installation folder

## Closing

Just close the terminal window

## Command line

Type 'help' on the command line to bring up a list of runtime options

## layout.js

By default, the simulator starts on port 5550, and creates an instance of every module
While useful for capacity testing, it's tedious to use all the modules if testing just one or two
So the simulator looks for a 'layout.js' file on startup, and if found, will use that instead of the inbuilt defaults
There is an example file (layout.js.example) that can be renamed and modified as necesary

## unit testing

There are unit tests, which can be run using 'npm test', it takes about 1 minute
Not everything is covered, but does give a useful confidence test if anything has been changed
see [Running tests](running_tests.md) for more info
