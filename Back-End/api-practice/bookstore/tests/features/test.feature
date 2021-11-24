Feature: API is running

  Scenario: Check Home endpoint
    Given I make a GET request to "http://localhost:3000/api/v1/books/"
    When I receive a response
    Then response should have a status 200