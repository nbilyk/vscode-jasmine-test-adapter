import * as util from 'util';
import { LoadTestsReporter } from './loadTestsReporter';
import { patchJasmine } from './patchJasmine';


function sendMessage(message: any): Promise<void> {
	if (!process.send) return Promise.resolve()
	return new Promise((resolve, reject) => {
		process.send!(message, undefined, undefined, (error) => {
			if (error)
				reject(error)
			else
				resolve()
		})
	})
}

async function sendDataInChunks(data: string, chunkSize: number = 512): Promise<void> {
    sendMessage({ type: 'start' });
	for (let start = 0; start < data.length; start += chunkSize) {
    	const chunk = data.substring(start, start + chunkSize);
        await sendMessage({ type: 'data', data: chunk });
    }
    sendMessage({ type: 'end' });
};

let logEnabled = false;
try {

	const jasminePath = process.argv[2];
	const configFile = process.argv[3];
	const testFileGlobs: string[] = JSON.parse(process.argv[4]);
	logEnabled = <boolean>JSON.parse(process.argv[5]);
	logEnabled = true // TEMP I don't know how to turn logs on

	const Jasmine = require(jasminePath);
	const jasmine = new Jasmine({});
	if (logEnabled) sendMessage('Patching Jasmine');
	const locations = patchJasmine(jasmine, testFileGlobs);
	if (logEnabled) sendMessage('Loading config file');
	jasmine.loadConfigFile(configFile);

	if (logEnabled) sendMessage('Executing Jasmine');
	jasmine.execute(undefined, '$^');

	// The reporter must be added after the call to jasmine.execute() because otherwise
	// it would be removed if the user changes the reporter in the helper files. 
	// Note that jasmine will start the tests asynchronously, so the reporter will still
	// be added before the tests are run.
	if (logEnabled) sendMessage('Creating and adding reporter');
	jasmine.env.addReporter(new LoadTestsReporter((results) => {
		return sendDataInChunks(JSON.stringify(results));
	}, locations));

} catch (err) {
	if (logEnabled) sendMessage(`Caught error ${util.inspect(err)}`);
	throw err;
}