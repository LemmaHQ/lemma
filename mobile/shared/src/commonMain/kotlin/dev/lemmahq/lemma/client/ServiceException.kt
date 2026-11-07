package dev.lemmahq.lemma.client

/** A failed call to a Lemma service; [failure] says why. */
class ServiceException(val failure: ServiceFailure, cause: Throwable? = null) :
    Exception(failure.name, cause)
