'use strict';

const test = require('tape');
const sinon = require('sinon');
const request = require('supertest');

let server;
const oddworks = require('../server');
const accessToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2ZXJzaW9uIjoxLCJjaGFubmVsIjoib2RkLW5ldHdvcmtzIiwicGxhdGZvcm0iOiJhcHBsZS1pb3MiLCJzY29wZSI6WyJwbGF0Zm9ybSJdLCJpYXQiOjE0NjA5ODg5NzB9.-k0wFuWD3FFaRZ7btIad9hiJJyEIBqiR4cS8cGeGMoM';
const analyzers = require('../services/events/analyzers');
const eventsService = require('../services/events');
const testHelper = require('./test-helper');

const customAnalyzers = [{
	send(payload) {
		return payload;
	}
}, {
	send(payload) {
		return payload;
	}
}, {
	forward(payload) {
		return payload;
	}
}];

test('EVENTS', t => {
	eventsService.initialize(testHelper.bus, {analyzers: customAnalyzers});

	oddworks
		.then(result => {
			server = result;
			t.end();
		});
});

test('Route: /events', t => {
	t.plan(1);

	request(server.app)
		.post('/events')
		.set('Accept', 'application/json')
		.set('x-access-token', accessToken)
		.expect(201)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			t.ok(res.body);
			t.end(err);
		});
});

test(`{role: 'events'}`, t => {
	t.plan(3);

	const spy1 = sinon.spy(customAnalyzers[0], 'send');
	const spy2 = sinon.spy(customAnalyzers[1], 'send');
	const spy3 = sinon.spy(customAnalyzers[2], 'forward');

	const payload = {
		distinctId: 131313,
		sessionId: 99999,
		contentId: 'daily-show-video-1',
		contentType: 'video',
		title: 'Daily Show 1',
		action: 'video:play',
		channel: 'odd-networks',
		platform: 'apple-ios',
		category: 'MOBILE',
		elapsed: 10000,
		duration: 60000
	};

	testHelper.bus.observe({role: 'events'}, () => {
		t.ok(spy1.calledOnce, 'analyzer 1 .send() called');
		t.ok(spy2.calledOnce, 'analyzer 2 .send() called');
		t.ok(spy3.notCalled, 'analyzer 3 .send() does not exist and .forward() not called');

		customAnalyzers[0].send.restore();
		customAnalyzers[1].send.restore();
		customAnalyzers[2].forward.restore();
		t.end();
	});

	testHelper.bus.broadcast({role: 'events'}, payload);
});

test('Google Analytics', t => {
	t.plan(12);

	let googleAnalytics = new analyzers.googleAnalytics(); // eslint-disable-line
	t.notOk(googleAnalytics.options.trackingId, 'cannot initialize with a trackingId');

	googleAnalytics = new analyzers.googleAnalytics({trackingId: '12345'}); // eslint-disable-line
	const payload = {
		sessionId: 99999,
		contentId: 'daily-show-video-1',
		contentType: 'video',
		action: 'video:play'
	};
	const preparedPayload = googleAnalytics.prepare(payload);
	t.ok(preparedPayload.visitor, 'visitor is set');
	t.equal(preparedPayload.params.t, 'event', 'payload type is set');
	t.notOk(preparedPayload.params.av, 'av not set');
	t.notOk(preparedPayload.params.an, 'an not set');
	t.equal(preparedPayload.params.ds, 'app', 'ds is app');
	t.equal(preparedPayload.params.ec, 'video', 'ec is the action type');
	t.equal(preparedPayload.params.ea, 'play', 'ea is the action sub type');
	t.equal(preparedPayload.params.cd, 'video-daily-show-video-1', 'cd is the video id');
	t.notOk(preparedPayload.params.geoid, 'geoid not set');
	t.notOk(preparedPayload.params.uip, 'uip not set');
	t.notOk(preparedPayload.params.ua, 'ua not set');

	t.end();
});

test('Mixpanel', t => {
	t.plan(15);

	let mixpanel = new analyzers.mixpanel(); // eslint-disable-line
	t.notOk(mixpanel.options.instance, 'cannot initialize with a trackingId');

	mixpanel = new analyzers.mixpanel({apiKey: '12345', timeMultiplier: 1000}); // eslint-disable-line
	const payload = {
		distinctId: 131313,
		sessionId: 99999,
		contentId: 'daily-show-video-1',
		contentType: 'video',
		title: 'Daily Show 1',
		action: 'video:play',
		channel: 'odd-networks',
		platform: 'apple-ios',
		category: 'MOBILE',
		elapsed: 10000,
		duration: 60000
	};
	const preparedPayload = mixpanel.prepare(payload);
	t.equal(preparedPayload.distinct_id, 131313, 'distinct id type is set');
	t.equal(preparedPayload.channel_id, 'odd-networks', 'channel id is is app');
	t.equal(preparedPayload.platform_id, 'apple-ios', 'platform id is is app');
	t.equal(preparedPayload.content_type, 'video', 'content type set');
	t.equal(preparedPayload.content_id, 'daily-show-video-1', 'content id set');
	t.notOk(preparedPayload.geo_id, 'geo id not set');
	t.notOk(preparedPayload.ip, 'ip not set');
	t.notOk(preparedPayload.user_agent, 'user agent not set');
	t.notOk(preparedPayload.x_user_agent, 'x user agent not set');
	t.equal(preparedPayload['Video Title'], 'Daily Show 1', 'title set');
	t.equal(preparedPayload['Time Watched'], 10000, 'time watch set');
	t.equal(preparedPayload.Category, 'MOBILE', 'category set');
	t.equal(preparedPayload.duration, 60000, 'duration set');
	t.equal(preparedPayload['Completion Percentage'], 20, '% completed set');

	t.end();
});