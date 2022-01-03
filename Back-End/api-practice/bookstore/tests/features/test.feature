Feature: API is running


  Scenario: Getting All books
    Given I make a GET request to http://localhost:3000/api/v1/books/
    When I receive a response
    Then I expect response should have a status 00


  Scenario: Getting a single book
    Given I make a GET request to http://localhost:3000/api/v1/books/618a649f8b756c3f50def96d
    When I receive a response
    Then I expect response should have a status 200


  Scenario: Signup New User
    Given I make a POST request to http://localhost:3000/api/v1/users/signup
    And I set body to
    """
    {"name": "test","email": "test@test.com","password": "this is test","passwordConfirm": "this is test"}
    """
    When I receive a response
    Then I expect response should have a status 201


  Scenario: Login Existing User
    Given I make a POST request to http://localhost:3000/api/v1/users/login
    And I set body to
    """
    {"email": "logintest@test.com","password": "this is login test"}
    """
    When I receive a response
    Then I expect response should have a status 200
    And I expect response should have a json like
    """
    {"data": {"user": {"_id": "61a0e1c058868fff84fbe9f0","name": "login test","email": "logintest@test.com","role": "reader","active": "true", "__v": 0}}}
    """